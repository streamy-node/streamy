class ContentManager{
  constructor(){
    this.langs = {};
    this.templates = {};
    this.emptyMgr = new EmptyContent(this.templates,this.langs);
    this.moviesMgr = new MoviesContent(this.templates,this.langs);
    this.seriesMgr = new SeriesContent(this.templates,this.langs);
  }

  load(code,onSuccess){
    var self = this;
    this.loadTemplates((templates)=>{
      self.loadLang(code,(lang)=>{
        for (var key in templates) {
          self.templates[key] = templates[key];
        }
        self.langs.active = lang;
        onSuccess();
      })
    })
  }

  loadTemplates(onSuccess){
    var self = this;
    $.when(
      $.get("movies.html"),
      $.get("series.html"),
      $.get("serie.html")).done(function(a1,a2,a3){
        var templates = {}
        templates.movies =  a1[0];
        templates.series =  a2[0];
        templates.serie =  a3[0];
      // the code here will be executed when all four ajax requests resolve.
      // a1, a2, a3 and a4 are lists of length 3 containing the response text,
      // status, and jqXHR object for each of the four ajax calls respectively.
      onSuccess(templates);
    });
  }

  loadLang(code,onSuccess){
    var self = this;
    $.getJSON("locales/"+code+".json",function(data){
      onSuccess(data);
    });
  }

  setContent(div,type){
    if(type === "#movies"){
      this.moviesMgr.render(div);
    }else if(type === "#series"){
      this.seriesMgr.render(div);
    }else if(type === "#addSerie"){
      this.seriesMgr.renderAddSerie(div);
    }else if(type === "#serie"){//#serie?id=xxx
      this.seriesMgr.renderSerie(div,0);
    }else{
      this.emptyMgr.render(div);
      console.error("Not implemented hash ", type);
    }
  }
}
