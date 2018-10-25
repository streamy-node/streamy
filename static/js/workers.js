class WorkerController{
    constructor(templates,langs){
        this.templates = templates;
    }

    render(div){
        $(div).html(this.templates.workers);
    }

}