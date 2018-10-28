class TranscodingController{
    constructor(templates,sws){
        this.templates = templates;
        this.tasksStatus = {};
        this.isInitialized = false;
        this.sws = sws;
        this.div = null;
    }

    render(div){
        this.div = div;
        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.transcoding);
        $.getJSON( "transcoding_tasks", function( tasks ) {
            self.renderTranscodingTasks(Object.values(tasks.offline));
        });
    }

    resetRender(){
        render(self.div)
    }

    initialize(){
        var self = this;
        //Websocket
        var ws_worker = this.sws.subscribe('/notifications/transcoding')

        ws_worker.on('taskAdded', function(task){
            self.appendTask(task);
        });
        ws_worker.on('taskUpdated', function(task){
            self.updateTask(task);
        });
        ws_worker.on('taskRemoved', function(taskId){
            self.removeTask(taskId);
        });
    }

    renderTranscodingTasks(tasksByMedia){
        for(var i=0; i<tasksByMedia.length; i++){
            let tasks = Object.values(tasksByMedia[i]) 
            for(let j=0; j<tasks.length ; j++){
                this.appendTask(tasks[j]);
            }
        } 
    }

    appendTask(task){
        this.appendToContainer("#tasks_list",this.renderTranscodingTask(task));
    }
    
    renderTranscodingTask(task){
        var template = $("#task_status_tpl").clone();
        template.attr('id','');
        template.removeClass("hidden");
        this.tasksStatus[task.id] = template;
        
        this.updateTask(task);
        //connect buttons
        //'/transcoding_tasks/:id/start'
        template.find(".stop_process_btn").click(function(){
            postAsJson({},"/transcoding_tasks/"+task.filename+"/stop", function(response){
            },function(response){
                alert("Failed to stop task "+response);
            },false)
        });

        template.find(".start_task_btn").click(function(){
            postAsJson({},"/transcoding_tasks/"+task.filename+"/start", function(response){
            },function(response){
                alert("Failed to start task "+response);
            },false)
        });

        template.find(".remove_process_btn").click(function(){
            var r = confirm("You will remove the task "+task.original_name);
            if(r){
                deleteReq("/transcoding_tasks/"+task.filename);
            }
        });
        return template;
    }

    updateTask(task){
        let taskElement = this.tasksStatus[task.id]
        if(!taskElement){
            resetRender(div)
            return;
        }
        taskElement.find(".media_name").text(task.original_name);
        this.setTaskState(task.id,task.state_code,task.has_error);
               
        let tasksDone = 0;
        //let globalProgression = 0;
        for(let i=0; i<task.subtasks.length; i++){
            let subtask = task.subtasks[i];
            if(subtask){ 
                if(subtask.state_code == 0){//Done
                    tasksDone++;
                }
                //globalProgression += subtask.progression/task.subtasks.length
            }else{
                //Subtask not yet launched
            }
        }
        let progression = task.progression+" % "+tasksDone+"/"+task.subtasks.length;
        taskElement.find(".task_progression").text(progression);
        
    }

    setProgression(){
        this.transcodeText
    }

    setTaskState(taskId,state,hasError){
        let taskElem = this.tasksStatus[taskId]

        switch(state){
            case 0: // done
                taskElem.find(".done_status").removeClass("hidden");
                taskElem.find(".error_status").addClass("hidden");
                taskElem.find(".transcoding_status").addClass("hidden");
                taskElem.find(".waiting_status").addClass("hidden");
                taskElem.find(".stopped_status").addClass("hidden");
                taskElem.find(".remove_process_btn").addClass("hidden");
                taskElem.find(".stop_process_btn").addClass("hidden");
                taskElem.find(".start_process_btn").addClass("hidden");
                break;
            case 1: // error
                taskElem.find(".done_status").addClass("hidden");
                taskElem.find(".error_status").removeClass("hidden");
                taskElem.find(".transcoding_status").addClass("hidden");
                taskElem.find(".waiting_status").addClass("hidden");
                taskElem.find(".stopped_status").addClass("hidden");
                taskElem.find(".remove_process_btn").removeClass("hidden");
                taskElem.find(".stop_process_btn").addClass("hidden");
                taskElem.find(".start_process_btn").removeClass("hidden");
                break;
            case 2: //transcoding
                taskElem.find(".done_status").addClass("hidden");
                
                if(hasError){
                    taskElem.find(".error_status").removeClass("hidden");
                }else{
                    taskElem.find(".error_status").addClass("hidden");
                }

                taskElem.find(".transcoding_status").removeClass("hidden");
                taskElem.find(".waiting_status").addClass("hidden");
                taskElem.find(".stopped_status").addClass("hidden");
                taskElem.find(".remove_process_btn").removeClass("hidden");                
                taskElem.find(".stop_process_btn").removeClass("hidden");
                taskElem.find(".start_task_btn").addClass("hidden");
                break;
            case 3: //waiting
                taskElem.find(".done_status").addClass("hidden");
                if(hasError){
                    taskElem.find(".error_status").removeClass("hidden");
                }else{
                    taskElem.find(".error_status").addClass("hidden");
                }
                taskElem.find(".transcoding_status").addClass("hidden");
                taskElem.find(".waiting_status").removeClass("hidden");
                taskElem.find(".stopped_status").addClass("hidden");
                taskElem.find(".remove_process_btn").removeClass("hidden");
                taskElem.find(".stop_process_btn").removeClass("hidden");
                taskElem.find(".start_task_btn").addClass("hidden");
                break;
            case 4: //Paused
                taskElem.find(".done_status").addClass("hidden");
                if(hasError){
                    taskElem.find(".error_status").removeClass("hidden");
                }else{
                    taskElem.find(".error_status").addClass("hidden");
                }
                taskElem.find(".transcoding_status").addClass("hidden");
                taskElem.find(".waiting_status").addClass("hidden");
                taskElem.find(".stopped_status").removeClass("hidden");
                taskElem.find(".remove_process_btn").removeClass("hidden");
                taskElem.find(".stop_process_btn").addClass("hidden");
                taskElem.find(".start_task_btn").removeClass("hidden");
                break;
            default:
                console.warn("Unexpected status code for transcoding",state)
        }
    }

    removeTask(taskId){
        let taskElem = this.tasksStatus[taskId];
        taskElem.remove();
    }
    // <div class="online_status alert-success ml-2 mr-auto">Online</div>
    // <div class="offline_status alert-danger ml-2 mr-auto">Offline</div>

    // <button type="disable_worker_btn button" class="btn btn-warning mr-2">{{Disable}}</button>
    // <button type="enable_worker_btn button" class="btn btn-success mr-2">{{Enable}}</button>
    // <button type="remove_worker_btn button" class="btn btn-danger">{{Remove}}</button>

    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
        // let $container = $(containerId)
        // $container.append(elem);
    }    
}