
class MovieContent{
    constructor(templates,sharedWebsocket){
        this.templates = templates;
        this.blocks = new Map();
        this.mediaActiveProcess = new Map();
        this.block = null;
        this.sws = sharedWebsocket;
        this.div = null;
        this.mediaId = null;
        this.isInitialized = false;
        
    }

    initialize(){
        var self = this;
        //Websocket
        var ws_transcoding = this.sws.subscribe('/notifications/transcoding')

        ws_transcoding.on('taskAdded', function(task){
            self.updateProcess(task);
        });
        ws_transcoding.on('taskUpdated', function(task){
            self.updateProcess(task);
        });
        ws_transcoding.on('taskRemoved', function(taskId){
            //self.removeTask(taskId);
        });
    }

    pullProgressions(){
        var self = this;
        $.getJSON("transcoding_tasks",function(data){
            self.updateProgressions(data);
      });
    }

    render(div){
        this.div = div;
        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.movie);
        this.setup();
    }

    // serie.html
    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
    }

    renderSerie_elements(seriesInfos){
        for(var i=0; i<seriesInfos.length; i++){ 
            this.appendToContainer("#all_series",this.renderSeries_element(seriesInfos[i]));
        } 
    }

    renderSerie_season(brickId,seasonInfos){
        var template = $("#serie_season_tpl").clone();
        //console.log("template: ",template);
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".season_name").attr("href","#collapse_"+seasonInfos.season_number.toString());
        template.find(".season_name").append(seasonInfos.title);
        template.find(".panel-collapse").attr("id","collapse_"+seasonInfos.season_number.toString());

        for(var i=0; i<seasonInfos.children.length; i++){
            let episode = seasonInfos.children[i];
            let ep_tpl = $("#serie_episode_tpl").clone();
            //let data_path = "brick/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString();
            let data_path = "brick/"+brickId+"/"+encodeURIComponent(episode.path);
            
            ep_tpl.removeClass("hidden");
            ep_tpl.find(".box").attr("video_id",episode.id.toString());
            //ep_tpl.find("img").attr("src","series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg");
            ep_tpl.find('.bloc-image').attr("src",data_path+"/fanart/img200.jpg");
            //ep_tpl.find('.episode-image').css('background-image', 'url(' + '"series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg"' + ')');
            ep_tpl.find(".episode_number").append(episode.episode_number.toString()+" - ");
            ep_tpl.find(".episode_title").append(episode.title);
            ep_tpl.find(".episode_overview").append(episode.overview);

            ep_tpl.find(".overview-expand").attr("href","#collapse_overview_"+episode.episode_number.toString());
            ep_tpl.find(".episode_overview").attr("id","collapse_overview_"+episode.episode_number.toString());

            //console.log("ep_tpl.html():",ep_tpl.html());
            template.find(".list-group").append(ep_tpl);

            let videoBock = new VideoBlock("episode",episode.id);
            videoBock.setup(ep_tpl);
            videoBock.setHasMpd(episode.has_mpd);
            this.blocks.set(episode.id,videoBock);
        }
        
        return template;
    }

    setup(){
        var self = this;
        //Get serie id
        var mediaId = null;
        if(location.hash.substr(0,6) === "#movie" && location.hash.length > 7){//#serie_id
            //Extract id
            mediaId = parseInt(location.hash.substr(7));
            this.mediaId = mediaId;
        }else{
            console.error("Invalid data");
        }

        //Render main description
        $.getJSON( "media/"+mediaId.toString(), function( mediaData ) {
            $("#mediaName").text(mediaData.title);
            $("#releasedate").text(mediaData.release_date.substr(0,4));
            $("#rating").text(mediaData.rating);
            $("#ratingcount").text(mediaData.rating_count);
            $("#overview").text(mediaData.overview);
            $("#poster").attr("src","/brick/"+mediaData.brick_id+"/"+encodeURIComponent(mediaData.path)+"/fanart/img500.jpg");

            let block_tpl = $(".box");
            //block_tpl.attr("video_id",mediaId.toString());
            let videoBock = new VideoBlock("movie",mediaData.id);
            videoBock.setup(block_tpl);
            videoBock.setHasMpd(mediaData.has_mpd);
            self.block = videoBock;
            self.pullProgressions();
        });

        $("#refresh").click(function(){
            //console.log("#addtitle/serie",videoInfos);
            postAsJson({},"/media/"+mediaId+"/refresh", function(response){
            },function(response){
                alert("Failed to refresh serie",response);
            })
        })
    }

    removeProgress(filename){
        //TODO
        //let videoBlock = this.blocks.get(progress.media_id)
    }

    updateProcess(progress){
        let videoBlock = this.block;
        if(videoBlock && progress.media_id == videoBlock.media_id){
            let previousProc = this.mediaActiveProcess.get(videoBlock.media_id)

            if(previousProc && previousProc.filename == progress.filename){
                videoBlock.updateStatus(progress.state_code,progress.progression,progress.msg);
            }else if(!previousProc || new Date() - previousProc.lastTime > 10 || //If last update too old switch process
            progress.progression > previousProc.progression){ // If progression is better switch to it
                this.mediaActiveProcess.set(progress.media_id,{filename:progress.filename,progression:progress.progression,lastTime:new Date()});
                videoBlock.updateStatus(progress.state_code,progress.progression,progress.msg);
            }
        }
    }
    
    updateProgressions(progressions){
        if(location.hash.includes("#movie_") && progressions && this.block){

            let videoId = this.block.id;
            let videoBlock = this.block;
            if(progressions.offline[videoId]){
                let progressionsOnMedia = Object.values(progressions.offline[videoId]);
                let bestProgression = null;
                for(let i=0; i<progressionsOnMedia.length; i++){
                    let progression = progressionsOnMedia[i];
                    if(!bestProgression || bestProgression.progression<progression.progression){
                        bestProgression = progression;
                    }
                }
                videoBlock.updateStatus(bestProgression.state_code,bestProgression.progression,bestProgression.msg);
                this.mediaActiveProcess.set(videoId,{filename:bestProgression.filename,progression:bestProgression.progression,lastTime:new Date()})
            }
        }
    }

}
