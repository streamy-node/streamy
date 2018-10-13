var fsutils = require('../fsutils');
const Semaphore = require("await-semaphore").Semaphore;

class MPDData{
    constructor(){

        this.line = "";
        this.attrs = new Map();

        //Content stored in file (usefull with big dash manifests)
        this.fileIndex = -1;
        this.fileSize = 0;
        this.fileSrc = "";

        //Content stored in ram
        this.content = "";
    }

    replaceId(newId){
        var regex2 = /id="([^> ]*)"/i;
        this.line = this.line.replace(regex2,'id="'+newId+'"');
    }

    getId(){
        var regex = /id="([^> ]*)"/i;
        let tmp = this.line.match(regex);
        return tmp;    
    }

    async _getContent(){
        if(this.content.length > 0){
            return this.content; 
        }else if(this.fileSrc.length > 0){
            let content = await fsutils.readPart(this.fileSrc,this.fileIndex, this.fileSize);
            return content.toString();
        }else{
            return "";
        }
    }
}

class AdaptationSet extends MPDData {
    constructor(){
        super();
        this.representations = [];
        this.idOffset = 0;
    }

    setId(newId){
        this.replaceId(newId);
    }

    setRepresentationFirstId(newId){
        this.idOffset = newId;
    }

    async getXML(){
        var output = "";
        output += this.line;

        for(var i=0; i<this.representations.length; i++){
            this.representations[i].setId(i+this.idOffset);
            output += await this.representations[i].getXML();
            output += "\n";
        }
        
        output += "		</AdaptationSet>\n";
        return output;
    }
}

class Representation extends MPDData {
    constructor(){
        super();
        this.baseURL = "";
        this.segments = new MPDData();
        this.fileBased = false;

    }

    async setId(newId){
        //Change representation Id
        super.replaceId(this.line,newId);

        //Update segments accordingly (Wrong should keep old one)
        let segmentsData = await this.segments._getContent();
        var regex1 = /\$RepresentationID\$/gi;
        this.segments.content = segmentsData.replace(regex1,newId.toString());
    }

    async getXML(){
        var output = "";
        output += this.line;
        output += this.baseURL;
        output += await this.segments._getContent();
        output += "			</Representation>\n";
        return output;
    }
}
//Class to parse mdfiles (without using xml parser for memory reasons)
class MPDFile{
    constructor(){
        this.data;

        //Deprecated
        // this.adaptationSets = [];
        // this.header = "";
        // this.mpdFile = null;
        // this.foot = "\n	</Period>\n</MPD>";//TODO get them from header parsing
        
    }

    // eraseBaseURLDuplicates(){
    //     const urlSet= new Set();
    //     for(var i=0; i<this.adaptationSets.length; i++){
    //         let aset = this.adaptationSets[i];
    //         var j = aset.representations.length;
    //         while (j--) {
    //             let rep = aset.representations[j];
    //             if (urlSet.has(rep.baseURL)) { 
    //                 aset.representations.splice(j, 1);
    //             }else{
    //                 urlSet.add(rep.baseURL);
    //             }
    //         }
    //     }
    // }

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
                let segmentAttrs = repr.SegmentTemplate[0].$;
                segmentAttrs.initialization = segmentAttrs.initialization.replace("$RepresentationID$",repr.$.id.toString());
                segmentAttrs.media = segmentAttrs.media.replace("$RepresentationID$",repr.$.id.toString());
            }

        }
    }

    async parse(mpdFile){

        try{
            this.data = await fsutils.parseXmlFile(mpdFile);
        }catch(error){
            console.error("Failed to parse mdp file: ",mpdFile);
            return false;
        }

        this.freezeTemplatesRepresentations();
        
        return true;
        // return new Promise(async (resolve, reject) => {
        //     var self = this;
        //     this.mpdFile = mpdFile;
        //     this.header = "";
        //     this.adaptationSets = [];
        //     var adaptationSets = [];
        //     var lastAdaptationSet = null;
        //     var lastRepresentation = null;
        //     var segmentCapture = false;
        //     var headerDone = false;

        //     if(! await fsutils.exists(mpdFile)){
        //         resolve(false);
        //         return;
        //     }

        //     fsutils.readLargeFileByLine2(mpdFile,0,
        //         function(line, byteIndex){
        //             if(line.indexOf("<AdaptationSet") >= 0){
        //                 headerDone = true;
                        
        //                 var adapatationSet = new AdaptationSet();
        //                 adapatationSet.line = line;
        //                 adapatationSet.attrs = self.parseAttrs(line);
        //                 adapatationSet.fileIndex = byteIndex;
        //                 adapatationSet.fileSrc = mpdFile;
        //                 adaptationSets.push(adapatationSet);
        //                 lastAdaptationSet = adapatationSet;
        //                 lastRepresentation = null;
        //             }else if(line.indexOf("<Representation") >= 0 && lastAdaptationSet !== null){
        //                 var representation = new Representation();
        //                 representation.line = line;
        //                 representation.attrs = self.parseAttrs(line);
        //                 representation.fileIndex = byteIndex;
        //                 representation.fileSrc = mpdFile;
        //                 lastAdaptationSet.representations.push(representation);
        //                 lastRepresentation = representation;

        //             }else if(line.indexOf("<BaseURL") >= 0 && lastRepresentation != null ){
        //                 lastRepresentation.baseURL = line;
        //             }if(line.indexOf("<Segment") >= 0 && lastRepresentation != null ){
        //                 lastRepresentation.segments.line = line;
        //                 lastRepresentation.segments.fileIndex = byteIndex;
        //                 lastRepresentation.segments.fileSrc = mpdFile;
        //                 lastRepresentation.segments.attrs = self.parseAttrs(line);
        //                 lastRepresentation.segments.fileSize = line.length;
        //                 segmentCapture = true;
        //             }else if(segmentCapture && lastRepresentation && lastRepresentation.segments){
        //                 lastRepresentation.segments.fileSize += line.length;
        //                 if(line.indexOf("/Segment") >= 0){
        //                     segmentCapture = false;
        //                 }
        //             }else if(!headerDone){
        //                 self.header += line;
        //             }
        //         },function(){
        //             self.adaptationSets = adaptationSets;
        //             resolve(true);
        //         });

        // });
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

        //merge only video adaptations sets ignoring lang, appends other types

        // for(let i=0; i< othermpd.adaptationSets.length; i++){
        //     let oaset = othermpd.adaptationSets[i];
        //     let ctype = oaset.attrs.get("contentType");
        //     let lang = oaset.attrs.get("lang");
        //     if( ctype === "video" ){
        //         let aset = this.getFirstAdaptationSetByContentType(ctype);
        //         if(aset){
        //             for( let j=0; j < oaset.representations.length; j++){
        //                 let orep = oaset.representations[j];
        //                 this.addRepresentation(aset,orep);
        //             }
        //         }else{
        //             //No video set found
        //             this.addAdaptationSet(oaset);
        //         }
        //     }else{
        //         this.addAdaptationSet(oaset);
        //     }
        // }

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
        //baseUrl

        // representation.push(baseUrl);
        // subAdatationSet.push(representation);

        // let adaptationSet = new AdaptationSet();
        // adaptationSet.line = '\t\t<AdaptationSet id="2" contentType="text" lang="'+lang+'" subsegmentAlignment="true">\n';

        // let representation = new Representation();
        // representation.line = '\t\t\t<Representation id="3" bandwidth="256" mimeType="text/vtt">\n';
        // representation.baseURL = '\t\t\t<BaseURL>'+baseUrl+'</BaseURL>\n';
        // representation.segments.content = "";

        // adaptationSet.representations.push(representation); 

        // this.adaptationSets.push(adaptationSet);
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
        
        // var self = this;
        // return new Promise(async function(resolve, reject) {
        //     //Create the file if it doesn't exists
        //     var fs = require('fs');
        //     var wstream = fs.createWriteStream(fileName,{encoding:'utf8'});
            
        //     wstream.on('finish', function(){
        //         resolve(true);
        //     });


        //     wstream.write(self.header);
        //     let representations = 0;
        //     for(let i=0; i<self.adaptationSets.length; i++){
        //         self.adaptationSets[i].setId(i);
        //         self.adaptationSets[i].setRepresentationFirstId(representations);
        //         representations+=self.adaptationSets[i].representations.length;

        //         let data = await self.adaptationSets[i].getXML();
        //         wstream.write(data);
        //     }
        //     wstream.write(self.foot);
        //     wstream.end();
        // });
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
                src_mpd.addSubtitleAdaptationSet(stream.tags.language,'subs/srt_'+stream.tags.language+"_"+stream.tags.title+".vtt");
            }
        }
        await src_mpd.save(destination);
        release();
    }

    //Merge only the first representation of src into dst 
    async mergeMpdFiles(src_mpd_path, dst_mpd_path){
        var src_mpd = new MPDFile();
        var dst_mpd = new MPDFile();

        var res = await src_mpd.parse(src_mpd_path,true);
        if(res === null){
            console.log("MDP: Failed to merge unexisting file");
            return null;
        }
        
        // Find corresponding adaptation set inside dst mpd if any
        res = await dst_mpd.parse(dst_mpd_path,false);//We don't need to parse segment for this one

        if(res === false){
            return src_mpd;
        }

        return this.mergeMpd(src_mpd,dst_mpd);
    }



    // async insertRepresentation(representation,targetMpd){
    //     var contentType = getValue("contentType",representation.adaptationSet);

    //     if(contentType === null){
    //         console.error("Cannot merge mpd file with no content type");
    //         return null;
    //     }

    //     //Find adaptation set line
    //     var line = await fsutils.getLineWithLargeFile(targetMpd,0,["AdaptationSet","contentType="+contentType]);
        
    //     if(!line){

    //     }
         
    // }



    // async extractFirstRepresentation(file){
    //     return new Promise((resolve, reject) => {
    //         var output = {};
    //         output.adaptationSet = null;
    //         output.representation = null;
    //         output.baseUrl = null;
    //         output.segementList = null;//Can be large

    //         var segmentCapture = false;
    
    //         fsutils.readLargeFile(file,
    //             function(line){
    //                 if(!output.adaptationSet && line.indexOf("AdaptationSet") >= 0){
    //                     output.adaptationSet = line;
    //                 }else if(!output.representation && line.indexOf("Representation") >= 0){
    //                     output.representation = line;
    //                 }else if(!output.baseUrl && line.indexOf("BaseURL") >= 0){
    //                     output.baseUrl = line;
    //                 }if(!output.segements && line.indexOf("Segment") >= 0){
    //                     output.segements = line;
    //                     segmentCapture = true;
    //                 }else if(segmentCapture){
    //                     output.segements += line;
    //                     if(line.indexOf("/Segmen")){
    //                         resolve();
    //                     }
    //                 }
                    
    //             },function(){
    //                 reject();
    //             })
    //     });


    // }

    // getValue(key,line){
    //     var idx = line.indexOf(key);
    //     var result = "";
    //     if(idx>=0){
    //         var char = null;
    //         var i = idx+1;
    //         while( char !== " " && char !== ">" && i < line.length ){
    //             result+= line[i];
    //             i++;
    //         }
    //         if(i != line.length){
    //             return result;
    //         }
    //     }
    //     return null;        
    // }


}

module.exports.MPDUtils = new MPDUtils();
module.exports.MPDFile = MPDFile;