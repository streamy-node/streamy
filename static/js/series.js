
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
        $(target).html(rendered);
    }

    render(target){
        var rendered = Mustache.render(this.templates.series, this.langs.active);
        $(target).html(rendered);
    }

    renderAddVideo(target){
        this.genericRender(target,this.templates.addvideo,{lang:this.langs.active,dyn:{}})
    }

    renderSerie(target,serieID){
        this.genericRender(target,this.templates.serie,{lang:this.langs.active,dyn:{}})
    }


}
