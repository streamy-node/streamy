var fsutils = require('../fsutils');
const Semaphore = require("await-semaphore").Semaphore;


// class VideoRepresentationInfos{
//     constructor(){
//         this.contentType = "";
//         this.mimeType = "";
//         this.lang = "";
//     }
// }
//Class to parse mdfiles (without using xml parser for memory reasons)
class MPDFile{
    constructor(){
        this.data;
    }

    getAdaptationSets(){
        return this.data.MPD.Period[0].AdaptationSet;
    }

    // Setup valid ids for adaptation sets and representations
    updateIds(){
        let adapts = this.getAdaptationSets();
        let cpt = 0;
        for(let i=0; i<adapts.length; i++){
            let atapt = adapts[i];
            atapt.$.id = i;

            for(let j=0; j<atapt.Representation.length ; j++){
                let repr = atapt.Representation[j];
                repr.$.id = cpt++;
            }
        }
    }

    freezeTemplatesRepresentations(){
        let adapts = this.getAdaptationSets();
        for(let i=0; i<adapts.length; i++){
            let atapt = adapts[i];
            for(let j=0; j<atapt.Representation.length ; j++){
                let repr = atapt.Representation[j];

                //We only support SegementTemplate for now
                if("SegmentTemplate" in repr){
                    let segmentAttrs = repr.SegmentTemplate[0].$;
                    segmentAttrs.initialization = segmentAttrs.initialization.replace("$RepresentationID$",repr.$.id.toString());
                    segmentAttrs.media = segmentAttrs.media.replace("$RepresentationID$",repr.$.id.toString());
                }
           }
        }
        return true;
    }

    async parse(mpdFile){

        try{
            this.data = await fsutils.parseXmlFile(mpdFile);
        }catch(error){
            console.error("Failed to parse mdp file: ",mpdFile);
            return false;
        }

        //Quick check
        if(!("MPD" in this.data)){
            console.error("Invalid mdp file: ",mpdFile);
            return false;
        }

        if(!this.freezeTemplatesRepresentations()){
            return false;
        }
        
        return true;
    }

    merge(othermpd){
        //merge only video adaptations sets ignoring lang, appends other types
        let otherAdaptationSets = othermpd.getAdaptationSets();
        for(let i=0; i< otherAdaptationSets.length; i++){
            let oaset = otherAdaptationSets[i];
            let ctype = oaset.$.contentType;
            let lang = oaset.$.lang;

            if( ctype === "video" ){

                //Try to find a matching adaptation set
                let aset = this.getFirstAdaptationSetByContentType(ctype);
                if(aset){
                    // Add all representations to this set
                    for( let j=0; j < oaset.Representation.length; j++){
                        let orep = oaset.Representation[j];
                        
                        this.addRepresentation(aset,orep);
                    }
                }else{
                    //No video set found
                    this.addAdaptationSet(oaset);
                }
            }else{
                this.addAdaptationSet(oaset);
            }
        }
    }

    addAdaptationSet(adaptationSet){
        this.data.MPD.Period[0].AdaptationSet.push(adaptationSet);
        //this.adaptationSets.push(adaptationSet);
    }

    addSubtitleAdaptationSet(lang,baseUrl){
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

    addRepresentation(adaptationSet,representation){
        adaptationSet.Representation.push(representation);
    }

    getFirstAdaptationSetByContentType(ctype){
        let adaptationSets = this.getAdaptationSets();
        for( let i = 0; i<adaptationSets.length; i++){
            let adaptSet = adaptationSets[i];
            if(adaptSet.$.contentType === ctype){
                return adaptSet;
            }
        }
        return null;
    }

    async save(fileName){
        this.updateIds();
        await fsutils.saveAsXML(fileName,this.data);
    }

    parseAttrs(line){
        var map = new Map();

        var regex = /([A-Z]+)="([^> ]*)"/gi;
        
        var res = regex.exec(line);
        while(res){
            map.set(res[1],res[2]);
            res = regex.exec(line);
        }
        return map;        
    }

    getValue(key,line){
        var idx = line.indexOf(key);
        var result = "";
        if(idx>=0){
            var char = null;
            var i = idx+1;
            while( char !== " " && char !== ">" && i < line.length ){
                result+= line[i];
                i++;
            }
            if(i != line.length){
                return result;
            }
        }
        return null;        
    }

    getAllRepresentationsInfos(){
        let representations = [];
        //merge only video adaptations sets ignoring lang, appends other types
        let adaptationSets = this.getAdaptationSets();
        for(let i=0; i< adaptationSets.length; i++){
            let oaset = adaptationSets[i];
            let ctype = oaset.$.contentType;
            let lang = oaset.$.lang;

            //Loop over representations
            for( let j=0; j < oaset.Representation.length; j++){
                let representation = {lang:lang,contentType:ctype};
                let orep = oaset.Representation[j];
                representation.mimeType = orep.$.mimeType;
                

                if(ctype === "video"){
                    representation.width = orep.$.width;
                    representation.height = orep.$.height;
                }else if(ctype === "audio"){
                    if("AudioChannelConfiguration" in orep){
                        let channelConf = orep.AudioChannelConfiguration[0];
                        representation.channels = channelConf.$.value;
                    }else{
                        //console.warn("")
                        representation.channels = null;
                    }


                }else if(ctype === "text"){
                    representation.baseURL = orep.BaseURL[0];
                }else{
                    console.log("Unknown adaptationSet skipped")
                    continue;
                }
                representations.push(representation);
            }
        }
        return representations;
    }

}

class MPDUtils{
    constructor(){
        this.mpdSemaphores = new Map();
    }

    async mergeMpdsToMpd(dst_mpd_path, mpdList){
        let dst_mpd = null;
        for(let i=0; i<mpdList.length; i++){
            let src_mpd = new MPDFile();
            let fileName = mpdList[i];
            var res = await src_mpd.parse(fileName,true);
            if(res === false){
                console.error("MDP: Failed to merge unexisting file: ",fileName);
            }else{
                if(dst_mpd){
                    dst_mpd.merge(src_mpd);
                }else{
                    dst_mpd = src_mpd;
                }
            }
        }

        if(dst_mpd === null){
            return false;
        }
        
        return await dst_mpd.save(dst_mpd_path);
    }

    async addStreamsToMpd(src_mpd_path, streams, destination){
        var src_mpd = new MPDFile();

        //Critical section, prevent from multiples parallel merges
        let release = null;
        if(!this.mpdSemaphores.has(src_mpd_path)){
            this.mpdSemaphores.set(src_mpd_path,new Semaphore(1));
        }
        release = await this.mpdSemaphores.get(src_mpd_path).acquire();

        var res = await src_mpd.parse(src_mpd_path,true);
        if(res === null){
            console.log("MDP: Failed to merge unexisting file");
            release();
            return null;
        }

        for(let i=0; i<streams.length; i++){
            let stream = streams[i];
            if(stream.codec_type == "subtitle"){
                src_mpd.addSubtitleAdaptationSet(stream.tags.language,'subs/'+stream.tags.title+"_"+stream.tags.language+".vtt");
            }
        }
        await src_mpd.save(destination);
        release();
    }
}

module.exports.MPDUtils = new MPDUtils();
module.exports.MPDFile = MPDFile;