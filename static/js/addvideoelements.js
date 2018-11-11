class AddMediaItem{
    constructor(type){
        var self = this;
        this.element = null;
        this.type = type;
        this.mediaId = null;
        this.search = null;
        this.onMediaAdded = (id)=>{                
            self.setAddable(false)
            self.setLink(id)
        };
        this.onMediaError = (err)=>{};
    }

    render(templateElement, showOverview = false){
        var template = templateElement.children().clone();
        this.element = template;
        template.attr('id','');
        template.removeClass("d-none");

        //setup content
        template.find(".matching_name").text("");

        let id = AddMediaItem.increment++;
        template.find(".media_overview").text("");
        template.find(".overview-expand").attr("href","#collapse_overview_"+id);
        template.find(".media_overview").attr("id","collapse_overview_"+id);

        if(showOverview){
            template.find(".media_overview").addClass("show");
        }

        //Connect buttons which have all infos they need
        var self = this;
        template.find(".remove_file_btn").click(function(){
            template.remove();
            if(self.onRemoved){
                self.onRemoved();
            }
        });

        //Link search
        this.search = new TmdbSearch(template.find(".parsed_name")[0],this.type,function(mediaInfos){
            self.updateAddFileResults([mediaInfos],false)
        });

        return template;
    }

    updateAddFileResults(results,removable=true){
        var self = this
        if(results.length == 0){
            return;
        }
        this.element.find(".matching_name").text(results[0].title);

        let date = "";
        if(this.type == "movie"){
            date = results[0].release_date
        }else if(this.type == "serie"){
            date = results[0].first_air_date
        }
        this.element.find(".matching_date").text("("+new Date(date).getFullYear().toString()+")");        

        this.element.find(".matching_rate").text(results[0].vote_average);

        this.element.find(".matching_rate").removeClass (function (index, className) {
            return (className.match (/(^|\s)text-\S+/g) || []).join(' ');
        });
        if(results[0].vote_average > 7.7){
            this.element.find(".matching_rate").addClass("text-success");
        }else if(results[0].vote_average > 7.0){
            this.element.find(".matching_rate").addClass("text-warning");
        }else{
            this.element.find(".matching_rate").addClass("text-danger");
        }
        this.element.find(".hintPoster").attr("src",theMovieDb.common.images_uri+"original"+results[0].poster_path);
        
        this.element.find(".media_overview").text(results[0].overview);

        this.element.find(".result_infos").removeClass("d-none")
        this.element.find(".hint_container").removeClass("d-none")

        if(removable){
            this.element.find(".remove_file_btn").removeClass("d-none")
        }
        
        this.element.find(".add_file_btn").removeClass("d-none");
        self.setLink(null)

        this.element.find(".add_file_btn").off().click(function(){
            console.log("Adding media metadata");
            self.postTitle(results[0],function(response){
                let id = response.id.toString()
                self.onMediaAdded(id);
            },function(err){

            });
        });
    }

    setLink(id = null){
        var self = this;
        this.id = id;
        if(!id){
            this.element.find(".link_media_btn").addClass('d-none')
        }else{
            this.element.find(".link_media_btn").removeClass('d-none')
            this.element.find(".link_media_btn").off().click(function(){
                if(self.type == "serie"){
                    window.location.hash = "#serie_"+id;
                }else if(self.type == "movie"){
                    window.location.hash = "#movie_"+id;
                }
            })
            
        }
    }

    setAddable(value){
        if(value){
            this.element.find(".add_file_btn").removeClass('d-none')
        }else{
            this.element.find(".add_file_btn").addClass('d-none')            
        }
    }
    
    postTitle(videoInfos,onSuccess,onError){
        var data = {moviedbId:videoInfos.id};
        if(this.type == "serie"){
            postAsJson(data,"/series", function(response){
                onSuccess(response)
            },function(response){
                alert("Failed to add serie "+response);
                onError(response)
            })
        }else if(this.type == "movie"){
            postAsJson(data,"/movies", function(response){
                onSuccess(response)
            },function(response){
                alert("Failed to add movie "+response);
                onError(response)
            })
        }
    }
}
AddMediaItem.increment = 0;

class AddMediaFileItem extends AddMediaItem{
    constructor(type){
        super(type)
        this.file = null;
        this.downloadingController = new DownloadStatus(type)
    }

    render(templateElement,file,year,showOverview = false){
        super.render(templateElement,showOverview);
        var self = this;
        this.file = file
        this.element.find(".add_file_name").text(file.name);
        this.element.find(".parsed_name").val(file.parsedName);

        if(file.parsedName){
            this.search.searchName(file.parsedName,year,function(results){
                self.updateAddFileResults(results,file);
            },function(err){
            })
        }

        this.onMediaAdded = function(id){
            self.setAddable(false)
            self.search.disable(true);
            self.id = id;
            if(self.file){
                self.uploadMedia(id,self.file);
            }
        }

        
        this.element.find(".remove_file_btn").click(function(){
            self.downloadingController.cancelUpload();
        });

        return this.element;
    }

    uploadMedia(mediaId, file, onFileAdded = () => {}, onFileError = () => {}){
        console.log("Uploading file "+file.name)

        var self = this;
        let target = "/upload/media/"+mediaId
        this.downloadingController.setup(this.element,target,mediaId);
        //window.location.hash = "#serie_"+response.id.toString();
        let r = uploadMgr.get(target,mediaId)
        r.addFile(file)

        // r.on('fileAdded', function(file, event){
        //     r.upload();
        //     onFileAdded(file, event)
        //     //console.log("On file added ",file,event)

        //     //self.showCancelUpload(true);
        // });
        // // r.on('fileSuccess', function(file, message){
        // //     console.log("On file success ",file, message)
        // //     self.showCancelUpload(false);
        // //     self.hideDownloadProgression();
        // // });
        // r.on('fileError', function(file, message){
        //     console.error("On file error ",file, message)
        //     onFileError(file,message)
        //     // self.showCancelUpload(false);
        //     // self.hideDownloadProgression();
        // });
        // r.on('fileProgress', function(file){
        //     //console.log("fileProgress ",file)
        //     self.showDownloadProgression(Math.floor(file.progress()*1000)/10)
        // });
        
    }
}

class AddEpisodeFileItem extends AddMediaFileItem{
    constructor(){
        super("serie")
    }

    render(templateElement,file,year,showOverview = false){
        super.render(templateElement,file,year,showOverview);
        var self = this;
        this.element.find(".matching_season").change( function(){
            file.season = parseInt(self.element.find(".matching_season").val())
        })
        this.element.find(".matching_episode").change( function(){
            file.episode = parseInt(self.element.find(".matching_episode").val())
        })

        //Replace default AddMediaFileItem behaviour to get episode mediaId
        this.onMediaAdded = function(mediaId){
            self.setAddable(false)
            self.search.disable(true);
            if(self.file){
                //For episode file we need to retreive episode id instead of serie id
                if(file.season && file.episode){
                    self.getEpisodeId(mediaId,self.file.season,self.file.episode, function(id){
                        self.uploadMedia(id,self.file);
                    })
                }else{
                    console.error("Cannot add a serie with an invalid season or episode number")
                 //TODO   
                }
            }
        }

        return this.element;
    }

    updateAddFileResults(results,removable=true){
        super.updateAddFileResults(results,removable)
        if(this.file.season){
            this.element.find(".serie_elem").removeClass("d-none")
            this.element.find(".matching_season").val(this.file.season);
        }
        if(this.file.episode){
            this.element.find(".serie_elem").removeClass("d-none")
            this.element.find(".matching_episode").val(this.file.episode);
        }
    }

    getEpisodeId(mediaId,seasonNumber,episodeNumber, onResult){
        ///episode/id
        $.getJSON( "episode/id?serie_id="+mediaId.toString()+"&season_nb="+seasonNumber.toString()+"&episode_nb="+episodeNumber.toString(), function( data ) {
            onResult(data.episode_id)
        });
    }
}