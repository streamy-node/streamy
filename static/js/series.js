
class SeriesContent extends ContentController{
    constructor(templates,mainGuiElements){
        super()
        this.templates = templates;

        // Search
        this.mainGuiElements = mainGuiElements;
        this.pattern = "";

        // Results grid
        this.orderby="added_date"
        this.infiniteScroll = new InfiniteScroll()
        this.ascending = false
    }

    renderHTML(target){
        let templates = this.templates.series;
        templates += this.templates.common;
        return $(target).html(templates);
    }

    /**
     * @override
     * @param {*} target 
     */
    _render(target){
        var self = this;

        this.setup(target)

        this.pattern = "";
        this.mainGuiElements.mainSearch.setCallback(function(pattern){
            console.log("Search: ",pattern)
            self.pattern = pattern;
            self.setup(target);
        })
        this.mainGuiElements.mainSearch.show()
    }

    setup(target){
        var self = this;
        this.renderHTML(target).ready(function(){

            var scrollElem =  $("#tpl_series");
            var scrollContent =  $(".scroll_content");

            self.infiniteScroll.setup(scrollElem,scrollContent,34, function(batchLength, lastOffset,onResult){
                self.addMore(batchLength, lastOffset, onResult)
            });
        });
    }

    addMore(batchLength, lastOffset, onResult){
        var self = this;
        self.getSeries(function(results){
            if(results == 0){
                onResult(0)
                return 
            }
            self.renderSeries_elements(results)
            onResult(results.length);
        },batchLength, lastOffset, this.orderby, this.ascending, this.pattern)
    }

    //HELPERS
    getSeries(onResult, count=0, offset=0, orderby="release_date", ascending=false, pattern=""){
        $.getJSON( "series/?count="+parseInt(count)+"&offset="+offset+"&orderby="+orderby+"&ascending="+ascending+"&pattern="+pattern, onResult);
    }

    // series.html
    renderSeries_element(serieInfos){
        var template = $("#poster_tpl").clone();
        template.attr("id","")
        template.removeClass("hidden");
        template.find("img").attr("src","/brick/"+serieInfos.brick_id+"/"+encodeURIComponent(serieInfos.path)+"/fanart/img200.jpg");
        template.find(".media_title").html(serieInfos.title+" ("+serieInfos.release_date.substr(0,4)+")");
        template.find(".media_rating").html(serieInfos.rating);
        template.find(".poster_link").attr("href","#serie_"+serieInfos.id);
        template.find(".poster_link").css("href","#serie_"+serieInfos.id);
        if(serieInfos.has_mpd){
            template.find(".video_broken").addClass("d-none");
        }
        return template;
    }

    renderSeries_elements(seriesInfos){ //TODO using only CSS?
        for(let i=0; i<seriesInfos.length; i++){ 
            $("#all_series").append(this.renderSeries_element(seriesInfos[i]));
        }
    }
}
