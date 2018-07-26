
class SeriesContent{
    constructor(templates,langs){
        this.movies;
        this.templates = templates;
        this.langs = langs;

        // this.defaults = {};
        // this.defaults.addSerie = {};
        // this.defaults.addSerie.video = {};
        // this.defaults.addSerie.video.ReleaseDate = "00/00/00";
    }


    genericRender(target,template,viewData){
        var rendered = Mustache.render(template, viewData);
        return $(target).html(rendered);
    }

    render(target){
        var rendered = Mustache.render(this.templates.series, this.langs.active);
        return $(target).html(rendered);
    }

    renderAddVideo(target){
        this.genericRender(target,this.templates.addvideo,{lang:this.langs.active,dyn:{}})
    }

    renderSerie(target,serieID){
        //Get serie infos
        var self = this;
        //var rendered = Mustache.render(template, viewData);
        this.genericRender(target,this.templates.serie,{lang:this.langs.active,dyn:{}}).ready(function(){
            self.setupSerie();
        });
    }

    renderSeries(target){
        var self = this;
        this.render(target).ready(function(){
            self.getSeries(function(results){
                self.renderSeries_elements(results)
            })
        });
    }

    //HELPERS
    getSeries(onResult, count=0, orderby="release_date", pattern=""){
        $.getJSON( "series/?count="+parseInt(count)+"&orderby="+orderby+"&pattern="+pattern, onResult);
    }

    //
    addToContainer(containerId,elem){
        $(containerId).first().after("<div class=\"col-sm-3 col-s-6\">"+elem+"</div>");
        //$(containerId).first().after(elem);

    }


    // series.html
    renderSeries_element(serieInfos){
        var template = $("#poster_tpl").clone();
        //template.attr("id","serie_"+parseInt(serieInfos.id));
        console.log(template.html());
        console.log(template.text());
        console.log(template);
        template.find("img").attr("src","/data/series/"+serieInfos.brick_id+"/"+serieInfos.original_name+" ("+serieInfos.release_date.substr(0,4)+")/fanart/img500.jpg");
        template.find(".series_titles").html(serieInfos.language.title+" ("+serieInfos.release_date.substr(0,4)+")");
        template.find(".series_rating").html(serieInfos.rating);
        template.find(".series_link").attr("href","#serie_"+serieInfos.id);
        template.find(".series_link").css("href","#serie_"+serieInfos.id);
        
        return template.html();
    }

    renderSeries_elements(seriesInfos){
        let width = $("#all_series").innerWidth();
        let imageWidth = 300;
        if(width > 576){
            imageWidth = 300;
        }else{
            imageWidth = 150;
        }
        let imagesByLine = (width-4)/(imageWidth);
        let lines = seriesInfos.length/imagesByLine;

        let row = '';
       // for(let l=0; l<lines; l++){
            //let $row = $("#all_series").append('<div class="row"></div>');
       //     let row = '<div class="row">';
            for(let i=0; i<seriesInfos.length; i++){ 
                row += this.renderSeries_element(seriesInfos[i]);
                //row += "<div class=\"col-sm-3 col-s-6\">"+this.renderSeries_element(seriesInfos[i])+"</div>";
                //$row.append("<div class=\"col-sm-3 col-s-6\">"+this.renderSeries_element(seriesInfos[i])+"</div>");
                //this.addToContainer("#all_series",this.renderSeries_element(seriesInfos[i]));
            }
       //     row += '</div>';
            $("#all_series").append(row);
        //}

        //$("#all_series").first().after('</div>');
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
        console.log(template.html());
        console.log(template.text());
        console.log(template);
        template.find(".season_name").attr("href","#collapse_"+seasonInfos.season_number.toString());
        template.find(".season_name").append(seasonInfos.title);
        template.find(".panel-collapse").attr("id","collapse_"+seasonInfos.season_number.toString());

        for(var i=0; i<seasonInfos.episodes.length; i++){
            var episode = seasonInfos.episodes[i];
            var ep_tpl = $("#serie_episode_tpl").clone();
            //ep_tpl.find("img").attr("src","series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg");
            ep_tpl.find('.episode-image').attr("src","series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg");
            //ep_tpl.find('.episode-image').css('background-image', 'url(' + '"series/"+serieId+"/data/season_"+seasonInfos.season_number.toString()+"/episode_"+episode.episode_number.toString()+"/fanart/img200.jpg"' + ')');
            ep_tpl.find(".episode_number").append(episode.episode_number.toString()+" - ");
            ep_tpl.find(".episode_title").append(episode.title);
            ep_tpl.find(".episode_overview").append(episode.overview);
            
            console.log("ep_tpl.html():",ep_tpl.html());
            template.find(".list-group").append(ep_tpl.html());

            var videoBock = new VideoBlock();
            videoBock.setup(ep_tpl);
        }
        
        return template.html();
    }

    renderSerie_seasons(serieId,seasonsInfos){
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
            $('#box-1').css('background-image', 'url(' + '"/data/series/'+data.brick_id+'/'+data.original_name+' ('+data.release_date.substr(0,4)+')/fanart/img300.jpg"' + ')');
            //$('.episode-image').css('background-image', 'url(' + '"/data/series/'+data.brick_id+'/'+data.original_name+' ('+data.release_date.substr(0,4)+')/fanart/img300.jpg"' + ')');
            
            
            //$("#serie_id").val(serieId);
            //$('#input-1').css('background-repeat', 'no-repeat');
        });

        //Render seasons and episodes
        $.getJSON( "series/"+serieId.toString()+"/seasons", function( data ) {
            self.renderSerie_seasons(serieId,data);
        });

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



}
