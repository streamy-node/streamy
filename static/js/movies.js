
class MoviesContent{
    constructor(templates,langs){
        this.movies;
        this.templates = templates;
        this.langs = langs;
    }

    render(target){
        var rendered = Mustache.render(this.templates.movies, this.langs.active);
        $(target).html(rendered);

    }

    
}