class MoviesContent{
    constructor(templates,sharedWebsocket, mainSearch){
        this.movies;
        this.templates = templates;
        this.sws = sharedWebsocket;
        this.isInitialized = false;
        this.mainSearch = mainSearch;

        //Progressions
        this.trElements = new Map()
        this.mediaActiveProcess = new Map();
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

    render(target){
        var self = this;
        this.trElements = new Map();
        this.mediaActiveProcess = new Map();

        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        self.setup(target);
            
        // self.mainSearch.elem.setCallback(function(){
        //     // TODO
        //     //self.setup(count=-1, offset=0, orderby="release_date", pattern="");
        // })
    }

    setup(target, count=-1, offset=0, orderby="release_date", pattern="Atomic"){
        var self = this;
        let templates = this.templates.movies;
        templates += this.templates.common;
        $(target).html(templates).ready(function(){
            self.getMovies(function(results){
                self.renderMovies_elements(results)
                self.pullProgressions()
            },count, offset, orderby, pattern)
        });
    }

    //HELPERS
    getMovies(onResult, count=-1, offset=0, orderby="release_date", pattern=""){
        $.getJSON( "movies/?count="+parseInt(count)+"&offset="+offset+"&orderby="+orderby+"&pattern="+pattern, onResult);
    }

    renderMovie_elements(mediaInfos){
        var template = $("#poster_tpl").clone();
        template.removeClass("hidden");
        template.attr("id","")
        template.find("img").attr("src","/brick/"+mediaInfos.brick_id+"/"+encodeURIComponent(mediaInfos.path)+"/fanart/img200.jpg");
        template.find(".media_title").html(mediaInfos.title+" ("+mediaInfos.release_date.substr(0,4)+")");
        template.find(".media_rating").html(mediaInfos.rating);
        template.find(".poster_link").attr("href","#movie_"+mediaInfos.id);
        template.find(".poster_link").css("href","#movie_"+mediaInfos.id);
        // if(mediaInfos.has_mpd){
        //     template.find(".video_broken").addClass("invisible");
        // }
        let transcodingStatus = new TranscodingStatus(mediaInfos.id)
        transcodingStatus.setup(template);
        transcodingStatus.setHasMpd(mediaInfos.has_mpd);
        this.trElements.set(mediaInfos.id,transcodingStatus)
        return template;
    }

    renderMovies_elements(seriesInfos){ //TODO using only CSS?
        for(let i=0; i<seriesInfos.length; i++){ 
            $("#all_movies").append(this.renderMovie_elements(seriesInfos[i]));
        }

        //$("#all_movies").append(row);
    }

    updateProcess(progress){
        let element = this.trElements.get(progress.media_id)
        if(element){
            let previousProc = this.mediaActiveProcess.get(progress.media_id)

            if(previousProc && previousProc.filename == progress.filename){
                element.updateStatus(progress.state_code,progress.progression,progress.msg);
            }else if(!previousProc || new Date() - previousProc.lastTime > 10 || //If last update too old switch process
            progress.progression > previousProc.progression){ // If progression is better switch to it
                this.mediaActiveProcess.set(progress.media_id,{filename:progress.filename,progression:progress.progression,lastTime:new Date()});
                element.updateStatus(progress.state_code,progress.progression,progress.msg);
            }
        }
    }

    updateProgressions(progressions){
        if(location.hash.includes("#movies") && progressions && this.trElements){ 
            let relevantMediaIds = Object.keys(progressions.offline).filter( id => this.trElements.has(parseInt(id)))
            for(let relevantMediaId of relevantMediaIds){
                let mediaProgressions = Object.values(progressions.offline[relevantMediaId])
                for(let progression of mediaProgressions){
                    this.updateProcess(progression)
                }
            }
        }
    }
}