class MoviesContent{
    constructor(templates,sharedWebsocket){
        this.movies;
        this.templates = templates;
        this.sws = sharedWebsocket;
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
        let templates = this.templates.movies;
        templates += this.templates.common;
        $(target).html(templates).ready(function(){
            self.setup()
        });
    }

    setup(){
        var self = this;
        self.getMovies(function(results){
            self.renderMovies_elements(results)
        })
    }

    //HELPERS
    getMovies(onResult, count=0, orderby="release_date", pattern=""){
        $.getJSON( "movies/?count="+parseInt(count)+"&orderby="+orderby+"&pattern="+pattern, onResult);
    }

    renderMovie_elements(mediaInfos){
        var template = $("#poster_tpl").clone();
        template.find("img").attr("src","/brick/"+mediaInfos.brick_id+"/"+encodeURIComponent(mediaInfos.path)+"/fanart/img500.jpg");
        template.find(".media_title").html(mediaInfos.title+" ("+mediaInfos.release_date.substr(0,4)+")");
        template.find(".media_rating").html(mediaInfos.rating);
        template.find(".poster_link").attr("href","#movie_"+mediaInfos.id);
        template.find(".poster_link").css("href","#movie_"+mediaInfos.id);
        if(mediaInfos.has_mpd){
            template.find(".video_broken").addClass("invisible");
        }
        return template.html();
    }

    renderMovies_elements(seriesInfos){ //TODO using only CSS?
        let width = $("#all_movies").innerWidth();
        let imageWidth = 300;
        if(width > 576){
            imageWidth = 300;
        }else{
            imageWidth = 150;
        }
        let imagesByLine = (width-4)/(imageWidth);
        let lines = seriesInfos.length/imagesByLine;

        let row = '';

        for(let i=0; i<seriesInfos.length; i++){ 
            row += this.renderMovie_elements(seriesInfos[i]);
        }

        $("#all_movies").append(row);
    }
}