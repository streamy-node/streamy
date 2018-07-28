
class SerieController{
    constructor(templates,langs){
        this.templates = templates;
        this.langs = langs;
        this.blocks = new Map();
        this.blocksWithProgression = new Map();
    }


    genericRender(target,template,viewData){
        var rendered = Mustache.render(template, viewData);
        return $(target).html(rendered);
    }

    render(target){
        var rendered = Mustache.render(this.templates.series, this.langs.active);
        return $(target).html(rendered);
    }

    renderSerie(target,serieID){
        //Get serie infos
        var self = this;
        //var rendered = Mustache.render(template, viewData);
        this.genericRender(target,this.templates.serie,{lang:this.langs.active,dyn:{}}).ready(function(){
            self.setupSerie();
        });
    }

    // serie.html

    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
        //$(containerId).first().after(elem);
    }

    // renderSerie_episode(serieInfos){
    //     var template = $("#poster_tpl").clone();
    //     //template.attr("id","serie_"+parseInt(serieInfos.id));
    //     console.log(template.html());
    //     console.log(template.text());
    //     console.log(template);
    //     template.find("img").attr("src","/data/series/"+serieInfos.brick_id+"/"+serieInfos.original_name+" ("+serieInfos.release_date.substr(0,4)+")/fanart/img500.jpg");
    //     template.find(".series_titles").html(serieInfos.language.title+" ("+serieInfos.release_date.substr(0,4)+")");
    //     template.find(".series_rating").html(serieInfos.rating);
    //     template.find(".series_link").attr("href","#serie_"+serieInfos.id);
        
    //     var videoBock = new VideoBlock();
    //     videoBock.setup(template);

    //     return template.html();
    // }

    renderSerie_elements(seriesInfos){
        for(var i=0; i<seriesInfos.length; i++){ 
            this.appendToContainer("#all_series",this.renderSeries_element(seriesInfos[i]));
        } 
    }

    renderSerie_season(serieId,seasonInfos){
        var template = $("#serie_season_tpl").clone();
        //template.attr("id","serie_"+parseInt(serieInfos.id));
        // console.log(template.html());
        // console.log(template.text());
        console.log("template: ",template);
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".season_name").attr("href","#collapse_"+seasonInfos.season_number.toString());
        template.find(".season_name").append(seasonInfos.title);
        template.find(".panel-collapse").attr("id","collapse_"+seasonInfos.season_number.toString());

        for(var i=0; i<seasonInfos.episodes.length; i++){
            let episode = seasonInfos.episodes[i];
            let ep_tpl = $("#serie_episode_tpl").clone();
            let data_path = "series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString();
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

            console.log("ep_tpl.html():",ep_tpl.html());
            template.find(".list-group").append(ep_tpl);

            let videoBock = new VideoBlock("episode",episode.id);
            videoBock.getStreamsInfos = function(onResult){
                $.getJSON( "episodes/streams/"+episode.id, function( data ) {
                    console.log("Stream infos "+episode.id,data);
                    onResult(data,data_path);
                });
            }
            videoBock.setup(ep_tpl);
            videoBock.setBroken(!episode.has_mpd);
            this.blocks.set(episode.id,videoBock);

        }
        
        return template;
    }

    renderSerie_seasons(serieId,seasonsInfos){
        this.blocks = new Map();
        for(var i=0; i<seasonsInfos.length; i++){ 
            this.appendToContainer("#seasons",this.renderSerie_season(serieId,seasonsInfos[i]));
        } 
    }

    setupSerie(){
        var self = this;
        //Get serie id
        var serieId = null;
        if(location.hash.substr(0,6) === "#serie" && location.hash.length > 7){//#serie_id
            //Extract id
            serieId = parseInt(location.hash.substr(7));
        }else{
            console.error("Invalid data");
        }

        //Render main description
        $.getJSON( "series/"+serieId.toString(), function( data ) {
            $("#serieName").text(data.language.title);
            $("#releasedate").text(data.release_date.substr(0,4));
            $("#rating").text(data.rating);
            $("#ratingcount").text(data.rating_count);
            $("#overview").text(data.language.overview);
            $("#poster").attr("src","/data/series/"+data.brick_id+"/"+data.original_name+" ("+data.release_date.substr(0,4)+")/fanart/img500.jpg");
            //$("#poster2").attr("src","/data/series/"+data.brick_id+"/"+data.original_name+" ("+data.release_date.substr(0,4)+")/fanart/img300.jpg");
            //$('#box-1').css('background-image', 'url(' + '"/data/series/'+data.brick_id+'/'+data.original_name+' ('+data.release_date.substr(0,4)+')/fanart/img300.jpg"' + ')');
        });

        //Render seasons and episodes
        $.getJSON( "series/"+serieId.toString()+"/seasons", function( data ) {
            self.renderSerie_seasons(serieId,data);

            // //TODFO
            // var videoBock = new VideoBlock();
            // videoBock.setup(ep_tpl,"serie",episode.id);
            // this.blocks.push(videoBock);
        });

        // $(".box").each(function(elem) {

        // });

        //Connect buttons
        $("#addtitle").click(function(){
            
            var data = {moviedbId:videoInfos.id};
            if(isSerie){
                console.log("#addtitle/serie",videoInfos);
                postAsJson(data,"/series", function(response){
                    alert("Serie link "+response.id.toString());
                },function(response){
                    alert("Failed to add serie",response);
                })
            }else{
                $.post("/movies", function(data, status){
                    alert("Movie Data: " + data + "\nStatus: " + status);
                });
            }
        });

        
    }
    
    // <div class="container" id="all-series">
    // <div class="row">
    //     <div class="col-sm-3">
    //         One of three columns
    //     </div>
    // Series display

    updateProgressions(progressions){
        if(location.hash.includes("#serie_")){
            for(let items of this.blocks){
                let videoId = items[0];
                let videoBlock = items[1];
                if(progressions[videoId]){
                    let progressionInfos = progressions[videoId];
                    videoBlock.updateStatus(progressionInfos.state_code,progressionInfos.progression);
    
                }
            }
        }
    }

}
