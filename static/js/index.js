class ContentManager{
  constructor(){
    this.langs = {};
    this.templates = {};
    this.moviesMgr = new MoviesContent(this.templates,this.langs);
    this.seriesMgr = new SeriesContent(this.templates,this.langs);
    this.serieMgr = new SerieController(this.templates,this.langs);

    var self = this;
    //Pull progressions
    setInterval(function(){
      self.updateProgressions();
    },5000)

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
      $.get("serie.html"),
      $.get("addvideo.html")).done(function(a1,a2,a3,a4){
        var templates = {}
        templates.movies =  a1[0];
        templates.series =  a2[0];
        templates.serie =  a3[0];
        templates.addvideo =  a4[0];
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
      $(div).html("<div id=\"\">Work in progress</div>");
      /*this.moviesMgr.render(div);*/
    }else if(type === "#series"){
      this.seriesMgr.renderSeries(div);
    }else if(type === "#addserie"){
      this.seriesMgr.renderAddVideo(div);
    }else if(type === "#addmovie"){
      this.seriesMgr.renderAddVideo(div);
    }else if(type.substr(0,6) === "#serie" && type.length > 7){//#serie_id
      //Extract id
      var serieId = parseInt(type.substr(7));
      this.serieMgr.renderSerie(div,serieId);
      this.updateProgressions();
    }else{
      $(div).html("<div id=\"\">Work in progress</div>");
      //this.emptyMgr.render(div);
      console.error("Not implemented hash ", type);
    }
  }

  updateProgressions(){
    var self = this;
    if(location.hash.includes("serie") || location.hash.includes("films")){
      $.getJSON("progression-infos",function(data){
        self.moviesMgr.updateProgressions(data);
        self.seriesMgr.updateProgressions(data);
        self.serieMgr.updateProgressions(data);
      });
    }

  }

  start(){
    var self = this;
    jQuery(document).ready(function () {
        $('#sidebarCollapse').on('click', function () {
            $('#sidebar').toggleClass('active');
            $(this).toggleClass('active');
        });
    });
    
    // Setup content
    //var contentMgr = new ContentManager();
    this.load("en",()=>{
        if(location.hash.length > 0){
          self.setContent("#content",location.hash);
        }else{
          self.setContent("#content","#dashboard");
        }
    });

    // Catch hash changes
    window.addEventListener("hashchange", function () {
            console.log("hash changed ",location.hash);
            self.setContent("#content",location.hash);
        }, false);
        
    // Just make last selected element a bit darker
    $('.nav-elems li').click(function(e) {
      $('.nav-elems li').removeClass('active');
      var $this = $(this);
      if (!$this.hasClass('active')) {
        $this.addClass('active');
      }
    });
    
    // TVDBKey
    theMovieDb.common.initialize();
    // Movies handle (todo use push)
    
    // Serie handle
    
    //
  }
}

//Main entry point
var contentManager = new ContentManager();
contentManager.start();
