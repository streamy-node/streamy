class TranscodingController extends ContentController {
  constructor(templates, sws) {
    super();
    this.templates = templates;
    this.tasksStatus = {};
    this.sws = sws;
    this.div = null;
  }

  /**
   * @override
   */
  _render(div) {
    this.div = div;

    var self = this;
    $(div).html(this.templates.transcoding);
    $.getJSON("transcoding_tasks", function(tasks) {
      self.renderTranscodingTasks(Object.values(tasks.offline));
    });
  }

  /**
   * @override
   */
  _initialize() {
    var self = this;
    //Websocket
    var ws_worker = this.sws.subscribe("/notifications/transcoding");
    ws_worker.on("reconnect", function(atempts) {
      $.getJSON("transcoding_tasks", function(tasks) {
        self.renderTranscodingTasks(Object.values(tasks.offline));
      });
    });

    ws_worker.on("taskAdded", function(task) {
      self.appendTask(task);
    });
    ws_worker.on("taskUpdated", function(task) {
      self.updateTask(task);
    });
    ws_worker.on("taskRemoved", function(taskId) {
      self.removeTask(taskId);
    });
  }

  renderTranscodingTasks(tasksByMedia) {
    this.clearTasks();
    for (var i = 0; i < tasksByMedia.length; i++) {
      let tasks = Object.values(tasksByMedia[i]);
      for (let j = 0; j < tasks.length; j++) {
        this.appendTask(tasks[j]);
      }
    }
  }

  clearTasks() {
    $("#tasks_list").empty();
    this.tasksStatus = {};
  }

  appendTask(task) {
    this.appendToContainer("#tasks_list", this.renderTranscodingTask(task));
  }

  renderTranscodingTask(task) {
    var template = $("#task_status_tpl").clone();
    template.attr("id", "");
    template.removeClass("hidden");
    this.tasksStatus[task.filename] = template;

    this.updateTask(task);
    //connect buttons
    //'/transcoding_tasks/:id/start'
    template.find(".stop_process_btn").click(function() {
      postAsJson(
        {},
        "/transcoding_tasks/" + task.filename + "/stop",
        function(response) {},
        function(response) {
          alert("Failed to stop task " + response);
        },
        false
      );
    });

    template.find(".start_task_btn").click(function() {
      postAsJson(
        {},
        "/transcoding_tasks/" + task.filename + "/start",
        function(response) {},
        function(response) {
          alert("Failed to start task " + response);
        },
        false
      );
    });

    template.find(".remove_process_btn").click(function() {
      var r = confirm("You will remove the task " + task.original_name);
      if (r) {
        deleteReq(
          "/transcoding_tasks/" + task.filename,
          function(success) {},
          function(err) {
            alert(err.responseText);
          }
        );
      }
    });
    return template;
  }

  updateTask(task) {
    let taskElement = this.tasksStatus[task.filename];
    taskElement.find(".media_name").text(task.original_name);

    if (task.msg && task.msg.length > 0) {
      taskElement.find(".task_message").text(task.msg);
      taskElement.find(".task_message").removeClass("hidden");
    }
    this.setTaskState(task.filename, task.state_code, task.has_error);

    let tasksDone = 0;
    //let globalProgression = 0;
    for (let i = 0; i < task.subtasks.length; i++) {
      let subtask = task.subtasks[i];
      if (subtask) {
        if (subtask.state_code == 0) {
          //Done
          tasksDone++;
        }
        //globalProgression += subtask.progression/task.subtasks.length
      } else {
        //Subtask not yet launched
      }
    }
    let progression =
      task.progression + " % " + tasksDone + "/" + task.subtasks.length;
    taskElement.find(".task_progression").text(progression);
  }

  setProgression() {
    this.transcodeText;
  }

  setTaskState(filename, state, hasError) {
    let taskElem = this.tasksStatus[filename];

    switch (state) {
      case 0: // done
        taskElem.find(".done_status").removeClass("hidden");
        taskElem.find(".error_status").addClass("hidden");
        taskElem.find(".transcoding_status").addClass("hidden");
        taskElem.find(".waiting_status").addClass("hidden");
        taskElem.find(".stopped_status").addClass("hidden");
        taskElem.find(".remove_process_btn").addClass("hidden");
        taskElem.find(".stop_process_btn").addClass("hidden");
        taskElem.find(".start_task_btn").addClass("hidden");
        break;
      case 1: // error
        taskElem.find(".done_status").addClass("hidden");
        taskElem.find(".error_status").removeClass("hidden");
        taskElem.find(".transcoding_status").addClass("hidden");
        taskElem.find(".waiting_status").addClass("hidden");
        taskElem.find(".stopped_status").addClass("hidden");
        taskElem.find(".remove_process_btn").removeClass("hidden");
        taskElem.find(".stop_process_btn").addClass("hidden");
        taskElem.find(".start_task_btn").removeClass("hidden");
        break;
      case 2: //transcoding
        taskElem.find(".done_status").addClass("hidden");

        if (hasError) {
          taskElem.find(".error_status").removeClass("hidden");
        } else {
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
        if (hasError) {
          taskElem.find(".error_status").removeClass("hidden");
        } else {
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
        if (hasError) {
          taskElem.find(".error_status").removeClass("hidden");
        } else {
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
        console.warn("Unexpected status code for transcoding", state);
    }
  }

  removeTask(filename) {
    let taskElem = this.tasksStatus[filename];
    taskElem.remove();
  }
  // <div class="online_status alert-success ml-2 mr-auto">Online</div>
  // <div class="offline_status alert-danger ml-2 mr-auto">Offline</div>

  // <button type="disable_worker_btn button" class="btn btn-warning mr-2">{{Disable}}</button>
  // <button type="enable_worker_btn button" class="btn btn-success mr-2">{{Enable}}</button>
  // <button type="remove_worker_btn button" class="btn btn-danger">{{Remove}}</button>

  appendToContainer(containerId, elem) {
    $(containerId)
      .first()
      .append(elem);
  }
}
