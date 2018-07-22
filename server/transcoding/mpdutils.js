//var fs = require('fs');
var fsutils = require('../fsutils');

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
            this.representations[i].replaceId(i+this.idOffset);
            output += await this.representations[i].getXML();
            output += "\n";
        }
        
        output += "		</AdaptationSet>";
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

    setId(newId){
        this.replaceId(this.line,newId);

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
        this.adaptationSets = [];
        this.header = "";
        this.mpdFile = null;
        this.foot = "\n	</Period>\n</MPD>";//TODO get them from header parsing
    }

    eraseBaseURLDuplicates(){
        const urlSet= new Set();
        for(var i=0; i<this.adaptationSets.length; i++){
            let aset = this.adaptationSets[i];
            var j = aset.representations.length;
            while (j--) {
                let rep = aset.representations[j];
                if (urlSet.has(rep.baseURL)) { 
                    aset.representations.splice(j, 1);
                }else{
                    urlSet.add(rep.baseURL);
                }
            }
        }
    }

    async parse(mpdFile){
        return new Promise(async (resolve, reject) => {
            var self = this;
            this.mpdFile = mpdFile;
            this.header = "";
            this.adaptationSets = [];
            var adaptationSets = [];
            var lastAdaptationSet = null;
            var lastRepresentation = null;
            var segmentCapture = false;
            var headerDone = false;

            if(! await fsutils.exists(mpdFile)){
                resolve(false);
                return;
            }

            fsutils.readLargeFileByLine2(mpdFile,0,
                function(line, byteIndex){
                    if(line.indexOf("<AdaptationSet") >= 0){
                        headerDone = true;
                        
                        var adapatationSet = new AdaptationSet();
                        adapatationSet.line = line;
                        adapatationSet.attrs = self.parseAttrs(line);
                        adapatationSet.fileIndex = byteIndex;
                        adapatationSet.fileSrc = mpdFile;
                        adaptationSets.push(adapatationSet);
                        lastAdaptationSet = adapatationSet;
                        lastRepresentation = null;
                    }else if(line.indexOf("<Representation") >= 0 && lastAdaptationSet !== null){
                        var representation = new Representation();
                        representation.line = line;
                        representation.attrs = self.parseAttrs(line);
                        representation.fileIndex = byteIndex;
                        representation.fileSrc = mpdFile;
                        lastAdaptationSet.representations.push(representation);
                        lastRepresentation = representation;

                    }else if(line.indexOf("<BaseURL") >= 0 && lastRepresentation != null ){
                        lastRepresentation.baseURL = line;
                    }if(line.indexOf("<Segment") >= 0 && lastRepresentation != null ){
                        lastRepresentation.segments.line = line;
                        lastRepresentation.segments.fileIndex = byteIndex;
                        lastRepresentation.segments.fileSrc = mpdFile;
                        lastRepresentation.segments.attrs = self.parseAttrs(line);
                        lastRepresentation.segments.fileSize = line.length;
                        segmentCapture = true;
                    }else if(segmentCapture && lastRepresentation && lastRepresentation.segments){
                        lastRepresentation.segments.fileSize += line.length;
                        if(line.indexOf("/Segment") >= 0){
                            segmentCapture = false;
                        }
                    }else if(!headerDone){
                        self.header += line;
                    }
                },function(){
                    self.adaptationSets = adaptationSets;
                    resolve(true);
                });

        });
    }

    addAdaptationSet(adaptationSet){
        this.adaptationSets.push(adaptationSet);
    }

    addSubtitleAdaptationSet(lang,baseUrl){
        let adaptationSet = new AdaptationSet();
        adaptationSet.line = '\t\t<AdaptationSet id="2" contentType="text" lang="'+lang+'" subsegmentAlignment="true">\n';

        let representation = new Representation();
        representation.line = '\t\t\t<Representation id="3" bandwidth="256" mimeType="text/vtt">\n';
        representation.baseURL = '\t\t\t<BaseURL>'+baseUrl+'</BaseURL>\n';
        representation.segments.content = "";

        adaptationSet.representations.push(representation); 

        this.adaptationSets.push(adaptationSet);
    }



    async addRepresentation(adaptType,representation){
        var matchingAdaptationSet = null;
        for(var i=0; i<this.adaptationSets.length; i++){
            let adaptationSet = this.adaptationSets[i];
            if(adaptationSet.attrs.get("contentType") === adaptType){
                matchingAdaptationSet = adaptationSet;
            }
        }

        matchingAdaptationSet.representations.push(representation);
    }

    async save(fileName){
        // let fileName = fileName_;
        // if(!fileName || fileName.length == 0){
        //     fileName = this.mpdFile;
        // }
        var self = this;
        return new Promise(async function(resolve, reject) {
            //Create the file if it doesn't exists
            var fs = require('fs');
            var wstream = fs.createWriteStream(fileName,{encoding:'utf8'});
            
            wstream.on('finish', function(){
                resolve(true);
            });

            wstream.write(self.header);
            let representations = 0;
            for(var i=0; i<self.adaptationSets.length; i++){
                self.adaptationSets[i].setId(i);
                self.adaptationSets[i].setRepresentationFirstId(representations);
                representations+=self.adaptationSets[i].representations.length;

                let data = await self.adaptationSets[i].getXML();
                wstream.write(data);
            }
            wstream.write(self.foot);
            wstream.end();
        });
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

    }

    async mergeMpd(src_mpd, dst_mpd){
        //For the moment merge only the first representation (streamy usecase)
        var src_adaptationSet = null;
        var src_representationSet = null;
        if(src_mpd.adaptationSets.length > 0){
            src_adaptationSet = src_mpd.adaptationSets[0];
            if(src_adaptationSet.representations.length > 0){
                src_representationSet = src_adaptationSet.representations[0];
            }
        }

        if(src_adaptationSet === null){
            console.error("MDP: no adaptationSet in file "+src_mpd_path);
            return null;
        }

        if(src_representationSet === null){
            console.error("MDP: no representation in file "+src_mpd_path);
            return null;
        }

        var matchingAdaptationSet = null;
        //var maxAdaptationSetId = -1;
        for(var i=0; i<dst_mpd.adaptationSets.length; i++){
            let dst_adaptationSet = dst_mpd.adaptationSets[i];
            if(dst_adaptationSet.attrs.get("contentType") == src_adaptationSet.attrs.get("contentType")){
                matchingAdaptationSet = dst_adaptationSet;
            }
        }

        var maxRepresentationId = -1;
        if(matchingAdaptationSet){
            await dst_mpd.addRepresentation(src_adaptationSet.attrs.get("contentType"),src_representationSet);

        }else if(!matchingAdaptationSet){
            //If there are no matching adaptation set, create it
            //src_adaptationSet.setId(maxAdaptationSetId++);
            dst_mpd.addAdaptationSet(src_adaptationSet);
        }

        //Find
        return dst_mpd;
    }

    async addStreamsToMpd(src_mpd_path, streams, destination){
        var src_mpd = new MPDFile();

        var res = await src_mpd.parse(src_mpd_path,true);
        if(res === null){
            console.log("MDP: Failed to merge unexisting file");
            return null;
        }

        for(let i=0; i<streams.length; i++){
            let stream = streams[i];
            src_mpd.addSubtitleAdaptationSet(stream.tags.language,'srt_'+stream.tags.language+"_"+stream.tags.title+".vtt");
        }
        await src_mpd.save(destination);
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



    async insertRepresentation(representation,targetMpd){
        var contentType = getValue("contentType",representation.adaptationSet);

        if(contentType === null){
            console.error("Cannot merge mpd file with no content type");
            return null;
        }

        //Find adaptation set line
        var line = await fsutils.getLineWithLargeFile(targetMpd,0,["AdaptationSet","contentType="+contentType]);
        
        if(!line){

        }
         
    }

    

    async extractFirstRepresentation(file){
        return new Promise((resolve, reject) => {
            var output = {};
            output.adaptationSet = null;
            output.representation = null;
            output.baseUrl = null;
            output.segementList = null;//Can be large

            var segmentCapture = false;
    
            fsutils.readLargeFile(file,
                function(line){
                    if(!output.adaptationSet && line.indexOf("AdaptationSet") >= 0){
                        output.adaptationSet = line;
                    }else if(!output.representation && line.indexOf("Representation") >= 0){
                        output.representation = line;
                    }else if(!output.baseUrl && line.indexOf("BaseURL") >= 0){
                        output.baseUrl = line;
                    }if(!output.segements && line.indexOf("Segment") >= 0){
                        output.segements = line;
                        segmentCapture = true;
                    }else if(segmentCapture){
                        output.segements += line;
                        if(line.indexOf("/Segmen")){
                            resolve();
                        }
                    }
                    
                },function(){
                    reject();
                })
        });


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

module.exports.MPDUtils = new MPDUtils();
module.exports.MPDFile = MPDFile;