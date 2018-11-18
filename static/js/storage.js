class StorageController{
    constructor(templates,sws){
        this.templates = templates;
        this.isInitialized = false;
        this.sws = sws;
    }

    render(div){
        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.storage);

        $.getJSON( "bricks", function( bricks ) {
            self.renderBricks(bricks);
        });

        $("#addBrickButton").click(function(){
            let alias = $("#brick_alias").val()
            let path = $("#brick_path").val()
            let enabled = $("#brick_enabled").val()
            let data = {alias:alias,path:path,enabled:enabled}
            postAsJson(data,"/bricks", function(response){
                $.getJSON( "bricks", function( bricks ) {
                    self.renderBricks(bricks);
                });
            },function(response){
                alert("Failed to add brick "+response);
            },false)
        });
    }

    initialize(){
    }

    renderBricks(bricks){
        $("#bricks_list").empty()
        for(var i=0; i<bricks.length; i++){ 
            this.appendBrick(bricks[i]);
        } 
    }

    appendBrick(brick){
        this.appendToContainer("#bricks_list",this.renderBrick(brick));
    }
    
    renderBrick(brick){
        var self = this;
        let id = brick.id;
        
        var template = $("#brick_tpl").clone();
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".brick_alias").text(brick.brick_alias);
        template.find(".update_brick_btn").addClass("d-none");
        let bpathElem = template.find(".brick_path");
        bpathElem.text(brick.brick_path);
        //let roleElem = template.find(".brick_role");
        //roleElem.val(user.role_name);

        // roleElem.on('change',function(){
        //     if(user.role_name !== roleElem.val()){
        //         template.find(".update_user_btn").removeClass("d-none")
        //     }
        // })

        bpathElem.on('change',function(){
            if(bpathElem.val().length > 0){
                template.find(".update_brick_btn").removeClass("d-none")
            }else{
                template.find(".update_brick_btn").addClass("d-none")
            }
        })

        //Disable commands for admin user (serverside blocked)
        // if(id == 1){
        //     roleElem.attr("disabled", "disabled");
        //     template.find(".remove_user_btn").addClass('d-none');   
        // }

        //connect buttons
        template.find(".remove_brick_btn").click(function(){
            var r = confirm("You will remove the brick "+brick.brick_alias+" with id "+brick.id);
            if(r){
                deleteReq("/bricks/"+encodeURIComponent(id),
                function(success){
                    template.remove()
                },
                function(err){
                    alert(err.responseText);
                })
            }
        });

        template.find(".update_brick_btn").click(function(){
            let alias = template.find(".brick_alias").val()
            let path = template.find(".brick_path").val();//template.find(".user_role").val()
            let enabled = template.find(".brick_enabled").val()
            let data = {alias:alias,path:path,enabled:enabled}

            postAsJson(data,"/bricks/"+id, function(response){
                $.getJSON( "bricks", function( bricks ) {
                    self.renderBricks(brickss);
                });
            },function(response){
                alert("Failed to update brick "+response);
            },false)
        });

        template.find(".cancel_btn").click(function(){
            $.getJSON( "bricks", function( bricks ) {
                self.renderBricks(bricks);
            });
        });
        return template;
    }

    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
    }    
}