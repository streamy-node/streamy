class MediaContentController extends ContentController{
    constructor(templates,sws){
        super()
        this.templates = templates;
        this.isInitialized = false;
        this.sws = sws;
        this.mediaId = null;
    }

    /**
     * @override
     * @param {*} div 
     */
    _render(div){
        var self = this;
        let mediaId = parseInt(location.hash.substr(14));
        this.mediaId = mediaId;

        $(div).html(this.templates.mediacontent);

        // fetch media infos from server
        $.getJSON( '/media/'+mediaId, function( media ) {
            let name = media.easy_name;
            if(name.length == 0){
                name = media.original_name;
            }
           $(".mpd-content-title").append(name)
        });

        // fetch infos from server
        $.getJSON( '/media/'+mediaId+'/mpd_files_resume', function( summaries ) {
            self.renderMpdFolders(Object.values(summaries));
        });

        /// Global button setup
    }

    renderMpdFolders(mpdInfos){
        for(var i=0; i<mpdInfos.length; i++){ 
            this.appendToContainer("#mpd_list",this.renderMpdFolder(mpdInfos[i]));
        } 
    }

    renderMpdFolder(mpdInfo){
        var self = this;
        var template = $("#mpd_list_tpl").clone();
        //console.log("template: ",template);
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".mpd_name").attr("href","#collapse_"+mpdInfo.folder.toString());
        template.find(".mpd_name").append(mpdInfo.folder);
        template.find(".panel-collapse").attr("id","collapse_"+mpdInfo.folder.toString());
        
        //setup buttons
        template.find(".mpd_remove_btn").click(function(){
            var r = true;
            if(mpdInfo.mpd){
                r = confirm("You want to remove an mpd with data "+mpdInfo.folder);
            }
            if(r){
                deleteReq("/media/"+self.mediaId+"/mpd/"+mpdInfo.folder,
                    function(response){
                        template.remove();
                    },
                    function(errReq){
                        alert("Failed to remove content. Reason: "+errReq.statusText+" "+errReq.responseText);
                    }
                );
            }
        });

        template.find(".mpd_preview_btn").click(function(){
            var r = true;
            window.open("js/light-player/index.html?id="+self.mediaId+"&folder_name="+mpdInfo.folder, "streamy player");

        });
        
        template.find(".mpd_insert_db_btn").click(function(){
            postAsJson({},"/media/"+self.mediaId+"/mpd/"+mpdInfo.folder+"/refresh", function(response){
                template.find(".mpd_insert_db_btn").addClass("d-none")
            },function(response){
                alert("Failed to start task "+response);
            },false)
        });


        //if there is not mpd
        if(!mpdInfo.mpd){
            template.find(".mpd-item").addClass("unavailable")
            template.find(".mpd_preview_btn").addClass("d-none")
            return template;
        }

        //If it's not in db add insert button 
        if(!mpdInfo.mpd_id){
            //Not tested yet
            template.find(".mpd_insert_db_btn").removeClass("d-none")
            
        }

        for(var i=0; i<mpdInfo.mpd.representations.length; i++){
            let mpdInfos = mpdInfo.mpd.representations[i];
            let mpd_tpl = $("#mpd_tpl").clone();
            mpd_tpl.removeClass("hidden");
            mpd_tpl.find(".rep_type").text(mpdInfos.contentType);
            mpd_tpl.find(".rep_lang").text(mpdInfos.lang ? mpdInfos.lang : '');
            
            switch(mpdInfos.contentType){
                case 'video':
                    mpd_tpl.find(".rep_resolution").text(mpdInfos.width+"p");
                    mpd_tpl.find(".rep_resolution").removeClass('d-none')
                break;
                case 'audio':
                    mpd_tpl.find(".rep_channels").text(mpdInfos.channels+"ch");
                    mpd_tpl.find(".rep_channels").removeClass('d-none')
                break
                case 'text':
                    mpd_tpl.find(".rep_name").text(mpdInfos.baseURL);
                    mpd_tpl.find(".rep_name").removeClass('d-none')
                break
                default:
                
            }

            //setup button
            mpd_tpl.find(".rep_remove_btn").click(function(){
                var r = true;
                if(mpdInfo.mpd){
                    r = confirm("You want to remove an representation with data "+mpdInfos.contentType);
                }
                if(r){
                    ///media/:mediaId/mpd/:folder/representation/:rep_id
                    deleteReq("/media/"+self.mediaId+"/mpd/"+encodeURIComponent(mpdInfo.folder)+"/representation/"+mpdInfos.id+"?safe_hash="+mpdInfos.safeHash,
                        function(response){
                            mpd_tpl.remove();
                        },
                        function(errReq){
                            alert("Failed to remove content. Reason: "+errReq.statusText+" "+errReq.responseText);
                        }
                    );
                }
            });

            template.find(".list-group").append(mpd_tpl);

        }

        return template;
    }

    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
    }


}