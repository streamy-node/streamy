
class SeriesContent{
    constructor(templates,langs){
        this.movies;
        this.templates = templates;
        this.langs = langs;
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
    }


    // series.html
    renderSeries_element(serieInfos){
        var template = $("#poster_tpl").clone();
        template.find("img").attr("src","/brick/"+serieInfos.brick_id+"/"+encodeURIComponent(serieInfos.path)+"/fanart/img500.jpg");
        template.find(".series_titles").html(serieInfos.title+" ("+serieInfos.release_date.substr(0,4)+")");
        template.find(".series_rating").html(serieInfos.rating);
        template.find(".series_link").attr("href","#serie_"+serieInfos.id);
        template.find(".series_link").css("href","#serie_"+serieInfos.id);
        if(serieInfos.has_mpd){
            template.find(".video_broken").addClass("invisible");
        }
        
        
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

        for(let i=0; i<seriesInfos.length; i++){ 
            row += this.renderSeries_element(seriesInfos[i]);
        }

        $("#all_series").append(row);
    }

    updateProgressions(progressions){

    }

}
