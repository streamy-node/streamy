
class SeriesContent{
    constructor(templates){
        this.movies;
        this.templates = templates;
    }

    render(target){
        let templates = this.templates.series;
        templates += this.templates.common;
        return $(target).html(templates);
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

    // series.html
    renderSeries_element(serieInfos){
        var template = $("#poster_tpl").clone();
        template.find("img").attr("src","/brick/"+serieInfos.brick_id+"/"+encodeURIComponent(serieInfos.path)+"/fanart/img500.jpg");
        template.find(".media_title").html(serieInfos.title+" ("+serieInfos.release_date.substr(0,4)+")");
        template.find(".media_rating").html(serieInfos.rating);
        template.find(".poster_link").attr("href","#serie_"+serieInfos.id);
        template.find(".poster_link").css("href","#serie_"+serieInfos.id);
        if(serieInfos.has_mpd){
            template.find(".video_broken").addClass("invisible");
        }
        return template.html();
    }

    renderSeries_elements(seriesInfos){ //TODO using only CSS?
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
}
