var path = require("path");
var fsutils = require("../utils/fsutils");
var jsutils = require("../utils/jsutils");
const Semaphore = require("await-semaphore").Semaphore;

// class VideoRepresentationInfos{
//     constructor(){
//         this.contentType = "";
//         this.mimeType = "";
//         this.lang = "";
//     }
// }
//Class to parse mdfiles (without using xml parser for memory reasons)
class MpdSanity {
  constructor() {
    this.isSane = false;
    this.noAudioChannelConfiguration = false;
    this.notFrozen = false;
  }
}

class MPDFile {
  constructor() {
    this.data;
    this.location = null;
    this.sanity = new MpdSanity();
  }

  getAdaptationSets() {
    return this.data.MPD.Period[0].AdaptationSet;
  }

  removeAdaptationSet(id, force = false) {
    let asets = this.data.MPD.Period[0].AdaptationSet;
    for (let j = 0; j < asets.length; j++) {
      let adset = asets[j];
      if (adset.$.id === id) {
        if (force || adset.Representation.length == 0) {
          asets.splice(j, 1);
          return true;
        } else {
          console.error("Cannot remove non empty adaptation set");
          return false;
        }
      }
    }
    return false;
  }

  // Setup valid ids for adaptation sets and representations
  updateIds() {
    let adapts = this.getAdaptationSets();
    let cpt = 0;
    for (let i = 0; i < adapts.length; i++) {
      let atapt = adapts[i];
      atapt.$.id = i;

      for (let j = 0; j < atapt.Representation.length; j++) {
        let repr = atapt.Representation[j];
        repr.$.id = cpt++;
      }
    }
  }

  freezeTemplatesRepresentations() {
    let adapts = this.getAdaptationSets();
    for (let i = 0; i < adapts.length; i++) {
      let atapt = adapts[i];
      for (let j = 0; j < atapt.Representation.length; j++) {
        let repr = atapt.Representation[j];

        //We only support SegementTemplate for now
        if ("SegmentTemplate" in repr) {
          let segmentAttrs = repr.SegmentTemplate[0].$;
          segmentAttrs.initialization = segmentAttrs.initialization.replace(
            "$RepresentationID$",
            repr.$.id.toString()
          );
          segmentAttrs.media = segmentAttrs.media.replace(
            "$RepresentationID$",
            repr.$.id.toString()
          );
        }
      }
    }
    return true;
  }

  async parse(mpdFile) {
    try {
      let content = await fsutils.read(mpdFile);
      this.data = await fsutils.parseXml(content);
      this.location = mpdFile;
      this.checkSanity(content);
    } catch (error) {
      console.error("Failed to parse mdp file: ", mpdFile, error);
      return false;
    }

    //Quick check
    if (!("MPD" in this.data)) {
      console.error("Invalid mdp file: ", mpdFile);
      return false;
    }

    if (!this.freezeTemplatesRepresentations()) {
      return false;
    }

    return true;
  }

  checkSanity(content) {
    //Tell the user that he should save the file because the file
    // has not enough info or is not stable by using $RepresentationID$ for example
    this.sanity.isSane = true;
    if (
      content.indexOf('contentType="audio"') >= 0 &&
      content.indexOf("AudioChannelConfiguration") < 0
    ) {
      this.sanity.noAudioChannelConfiguration = true;
      this.sanity.isSane = false;
    }
    if (content.indexOf("$RepresentationID$") >= 0) {
      this.sanity.notFrozen = true;
      this.sanity.isSane = false;
    }
  }

  merge(othermpd) {
    //merge only video adaptations sets ignoring lang, appends other types
    let otherAdaptationSets = othermpd.getAdaptationSets();
    for (let i = 0; i < otherAdaptationSets.length; i++) {
      let oaset = otherAdaptationSets[i];
      let ctype = oaset.$.contentType;
      let lang = oaset.$.lang;

      if (ctype === "video") {
        //Try to find a matching adaptation set
        let aset = this.getFirstAdaptationSetByContentType(ctype);
        if (aset) {
          // Add all representations to this set
          for (let j = 0; j < oaset.Representation.length; j++) {
            let orep = oaset.Representation[j];

            this.addRepresentation(aset, orep);
          }
        } else {
          //No video set found
          this.addAdaptationSet(oaset);
        }
      } else {
        this.addAdaptationSet(oaset);
      }
    }
  }

  addAdaptationSet(adaptationSet) {
    this.data.MPD.Period[0].AdaptationSet.push(adaptationSet);
    //this.adaptationSets.push(adaptationSet);
  }

  addSubtitleAdaptationSet(lang, baseUrl) {
    let subAdatationSet = {};
    subAdatationSet.$ = {};
    subAdatationSet.$.id = 0;
    subAdatationSet.$.contentType = "text";
    subAdatationSet.$.lang = lang;
    subAdatationSet.$.subsegmentAlignment = true;

    subAdatationSet.Representation = [];

    let representation = {};
    representation.$ = {};
    representation.$.id = 0;
    representation.$.bandwidth = "256";
    representation.$.mimeType = "text/vtt";

    representation.BaseURL = [];

    representation.BaseURL.push(baseUrl);
    subAdatationSet.Representation.push(representation);
    this.addAdaptationSet(subAdatationSet);
  }

  addRepresentation(adaptationSet, representation) {
    adaptationSet.Representation.push(representation);
  }

  getFirstAdaptationSetByContentType(ctype) {
    let adaptationSets = this.getAdaptationSets();
    for (let i = 0; i < adaptationSets.length; i++) {
      let adaptSet = adaptationSets[i];
      if (adaptSet.$.contentType === ctype) {
        return adaptSet;
      }
    }
    return null;
  }

  async save(fileName) {
    this.updateIds();
    await fsutils.saveAsXML(fileName, this.data);
  }

  parseAttrs(line) {
    var map = new Map();

    var regex = /([A-Z]+)="([^> ]*)"/gi;

    var res = regex.exec(line);
    while (res) {
      map.set(res[1], res[2]);
      res = regex.exec(line);
    }
    return map;
  }

  getValue(key, line) {
    var idx = line.indexOf(key);
    var result = "";
    if (idx >= 0) {
      var char = null;
      var i = idx + 1;
      while (char !== " " && char !== ">" && i < line.length) {
        result += line[i];
        i++;
      }
      if (i != line.length) {
        return result;
      }
    }
    return null;
  }

  getRepresentation(id) {
    //merge only video adaptations sets ignoring lang, appends other types
    let adaptationSets = this.getAdaptationSets();
    for (let i = 0; i < adaptationSets.length; i++) {
      let oaset = adaptationSets[i];

      //Loop over representations
      for (let j = 0; j < oaset.Representation.length; j++) {
        let orep = oaset.Representation[j];
        if (orep.$.id === id) {
          return orep;
        }
      }
    }
    return null;
  }

  checkHash(rep, safeHash) {
    if (safeHash) {
      let hash = this._generateRepresentationSafeHash(rep);
      if (safeHash != hash) {
        console.error(
          "Mpd representation safe hash not matching ",
          safeHash,
          hash
        );
        return false;
      }
    }
    return true;
  }

  removeRepresentation(id, safeHash = null) {
    let adaptationSets = this.getAdaptationSets();
    for (let i = 0; i < adaptationSets.length; i++) {
      let oaset = adaptationSets[i];

      //Loop over representations
      let found = false;
      for (let j = 0; j < oaset.Representation.length; j++) {
        let orep = oaset.Representation[j];
        if (orep.$.id === id) {
          if (!this.checkHash(orep, safeHash)) {
            console.error("Failed to remove representation");
            return null;
          }
          oaset.Representation.splice(j, 1);
          found = true;
          break;
        }
      }

      //Remove adaptation set if it was the last representation
      if (found) {
        if (oaset.Representation.length == 0) {
          this.removeAdaptationSet(oaset.$.id);
        }
        return true;
      }
    }

    return true;
  }

  getAllRepresentationsByType(type) {
    let representations = [];
    //merge only video adaptations sets ignoring lang, appends other types
    let adaptationSets = this.getAdaptationSets();
    for (let i = 0; i < adaptationSets.length; i++) {
      let oaset = adaptationSets[i];
      let ctype = oaset.$.contentType;
      if (ctype === type) {
        //Loop over representations
        for (let j = 0; j < oaset.Representation.length; j++) {
          let orep = oaset.Representation[j];
          representations.push(orep);
        }
      }
    }
    return representations;
  }

  getSummary() {
    let resume = {};
    resume.sanity = this.sanity;
    resume.representations = this.getAllRepresentationsResume();
    return resume;
  }
  getAllRepresentationsResume() {
    let representations = [];
    //merge only video adaptations sets ignoring lang, appends other types
    let adaptationSets = this.getAdaptationSets();
    for (let i = 0; i < adaptationSets.length; i++) {
      let oaset = adaptationSets[i];
      let ctype = oaset.$.contentType;
      let lang = oaset.$.lang;

      //Loop over representations
      for (let j = 0; j < oaset.Representation.length; j++) {
        let representation = { lang: lang, contentType: ctype };
        let orep = oaset.Representation[j];
        representation.mimeType = orep.$.mimeType;

        representation.id = orep.$.id;
        representation.safeHash = this._generateRepresentationSafeHash(orep);

        if (ctype === "video") {
          representation.width = orep.$.width;
          representation.height = orep.$.height;
        } else if (ctype === "audio") {
          if ("AudioChannelConfiguration" in orep) {
            let channelConf = orep.AudioChannelConfiguration[0];
            representation.channels = channelConf.$.value;
          } else {
            //console.warn("")
            representation.channels = null;
          }
        } else if (ctype === "text") {
          representation.baseURL = orep.BaseURL[0];
        } else {
          console.log("Unknown adaptationSet skipped");
          continue;
        }
        representations.push(representation);
      }
    }
    return representations;
  }

  _generateRepresentationSafeHash(rep) {
    let mtype = rep.$.mimeType;
    let hash = mtype;
    if (mtype.indexOf("text") >= 0) {
      hash += rep.BaseURL[0];
    } else if (mtype.indexOf("audio") >= 0) {
      if ("AudioChannelConfiguration" in rep) {
        hash += rep.AudioChannelConfiguration[0];
      }
    } else if (mtype.indexOf("video") >= 0) {
      hash += rep.$.width + "_" + rep.$.height;
    }
    return hash;
  }

  async getRepresentationFiles(id, safeHash = null) {
    let rep = this.getRepresentation(id);
    if (!rep) {
      console.error("Cannot get representation ", id);
      return null;
    }
    let type = rep.$.mimeType;
    let mpdFolder = path.dirname(this.location);
    let files = [];

    if (!this.checkHash(rep, safeHash)) {
      console.error("Failed to remove representation");
      return null;
    }

    if (type.indexOf("text") >= 0) {
      let burl = rep.BaseURL[0];
      if (burl.length > 0) {
        files.push(mpdFolder + "/" + burl);
      }
    } else if (type.indexOf("audio") >= 0 || type.indexOf("video") >= 0) {
      let tmpFiles = this._extractTemplateFiles(rep);
      for (let i = 0; i < tmpFiles.length; i++) {
        let tmpFile = tmpFiles[i];
        if (tmpFile.length > 0) {
          if (tmpFile.indexOf(".") < 0) {
            let tfiles = await fsutils.readirPrefix(mpdFolder + "/" + tmpFile);
            tfiles = tfiles.map(value => {
              return mpdFolder + "/" + value;
            });
            files = files.concat(tfiles);
          } else {
            files.push(mpdFolder + "/" + tmpFile);
          }
        }
      }
    } else {
      console.error("Unknown mime type: ", rep.$.mimeType);
    }
    return files;
  }

  _extractTemplateFiles(repr, onlyPrefix = false) {
    let outputs = [];
    if ("SegmentTemplate" in repr) {
      let segmentAttrs = repr.SegmentTemplate[0].$;
      outputs.push(segmentAttrs.initialization);
      outputs.push(this._extractTemplatePrefix(segmentAttrs.media));
    }
    return outputs;
  }

  _extractTemplatePrefix(fileName) {
    // Note: I didn't do it for $representationIs$ because I freeze mpd ...
    let index = fileName.indexOf("$Number");
    if (index > 0) {
      return fileName.substring(0, index);
    } else {
      return filename;
    }
  }
}

class MPDUtils {
  constructor() {
    this.mpdSemaphores = new Map();
  }

  async mergeMpdsToMpd(dst_mpd_path, mpdList) {
    let dst_mpd = null;
    for (let i = 0; i < mpdList.length; i++) {
      let src_mpd = new MPDFile();
      let fileName = mpdList[i];
      var res = await src_mpd.parse(fileName, true);
      if (res === false) {
        console.error("MDP: Failed to merge unexisting file: ", fileName);
      } else {
        if (dst_mpd) {
          dst_mpd.merge(src_mpd);
        } else {
          dst_mpd = src_mpd;
        }
      }
    }

    if (dst_mpd === null) {
      return false;
    }

    return await dst_mpd.save(dst_mpd_path);
  }

  async addStreamsToMpd(src_mpd_path, streams, destination) {
    var src_mpd = new MPDFile();

    //Critical section, prevent from multiples parallel merges
    let release = null;
    if (!this.mpdSemaphores.has(src_mpd_path)) {
      this.mpdSemaphores.set(src_mpd_path, new Semaphore(1));
    }
    release = await this.mpdSemaphores.get(src_mpd_path).acquire();

    var res = await src_mpd.parse(src_mpd_path, true);
    if (res === null) {
      console.log("MDP: Failed to merge unexisting file");
      release();
      return null;
    }

    for (let i = 0; i < streams.length; i++) {
      let stream = streams[i];
      if (stream.codec_type == "subtitle") {
        src_mpd.addSubtitleAdaptationSet(
          stream.tags.language,
          "subs/" + stream.tags.title + "_" + stream.tags.language + ".vtt"
        );
      }
    }
    await src_mpd.save(destination);
    release();
  }

  setAudioChannelConfiguration(representation, nbChannels) {
    if (!representation.AudioChannelConfiguration) {
      representation.AudioChannelConfiguration = [];
      let conf = {};
      conf.$ = {};
      representation.AudioChannelConfiguration.push(conf);
    }
    let conf = representation.AudioChannelConfiguration[0];
    conf.$.schemeIdUri =
      "urn:mpeg:dash:23003:3:audio_channel_configuration:2011";
    conf.$.value = nbChannels.toString();
    ('<AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="6"/>');
  }

  async upgradeMpd(ffmpeg, mpd) {
    if (mpd.sanity.isSane) {
      return true;
    }
    if (mpd.sanity.noAudioChannelConfiguration) {
      await this.updateMpdAudioChannels(ffmpeg, mpd);
      mpd.sanity.noAudioChannelConfiguration = true;
    }

    await mpd.save(mpd.location);
    mpd.sanity.isSane = true;
  }

  async updateMpdAudioChannels(ffmpeg, mpd) {
    //Get all representations
    let repsInfos = mpd.getAllRepresentationsByType("audio");

    //Get init segement from mpd for audio streams
    for (let i = 0; i < repsInfos.length; i++) {
      let repInfos = repsInfos[i];

      //Reach segment
      if (repInfos.SegmentTemplate && repInfos.SegmentTemplate.length == 1) {
        let segment = repInfos.SegmentTemplate[0];
        let initFile = segment.$.initialization;
        let absolutPath = path.dirname(mpd.location) + "/" + initFile;
        let channels = await this.extractAudioChannelsFromFile(
          ffmpeg,
          absolutPath
        );
        if (channels && channels > 0) {
          this.setAudioChannelConfiguration(repInfos, channels);
        }
      }
    }
  }

  async extractAudioChannelsFromFile(ffmpeg, absoluteSourceFile) {
    var infos = await ffmpeg.ffprobe(absoluteSourceFile);
    if (infos && "streams" in infos && infos.streams.length > 0) {
      let stream = infos.streams[0];
      if (stream.codec_type != "audio") {
        console.error(
          "Cannot count channels on non audio stream ",
          stream.codec_type
        );
        return null;
      }
      return stream.channels;
    }
    return null;
  }
}

module.exports.MPDUtils = new MPDUtils();
module.exports.MPDFile = MPDFile;
