class UsersController extends ContentController {
  constructor(templates, sws) {
    super();
    this.templates = templates;
    this.sws = sws;
  }

  /**
   * @override
   */
  _render(div) {
    var self = this;
    $(div).html(this.templates.users);

    $.getJSON("users", function(users) {
      self.renderUsers(users);
    });

    $("#addUserButton").click(function() {
      let username = $("#user_name").val();
      let password = $("#user_pwd").val();
      let role = $("#user_role").val();
      let data = { username: username, password: password, role: role };
      postAsJson(
        data,
        "/users",
        function(response) {
          $.getJSON("users", function(users) {
            self.renderUsers(users);
          });
        },
        function(response) {
          alert("Failed to add user " + response);
        },
        false
      );
    });
  }

  renderUsers(users) {
    $("#users_list").empty();
    for (var i = 0; i < users.length; i++) {
      this.appendUser(users[i]);
    }
  }

  appendUser(user) {
    this.appendToContainer("#users_list", this.renderUser(user));
  }

  renderUser(user) {
    var self = this;
    let id = user.id;

    var template = $("#user_status_tpl").clone();
    template.attr("id", "");
    template.removeClass("hidden");
    template.find(".user_name").text(user.username);
    template.find(".update_user_btn").addClass("d-none");
    let roleElem = template.find(".user_role");
    let pwdElem = template.find(".user_pwd");
    roleElem.val(user.role_name);

    roleElem.on("change", function() {
      if (user.role_name !== roleElem.val()) {
        template.find(".update_user_btn").removeClass("d-none");
      }
    });

    pwdElem.on("change", function() {
      if (pwdElem.val().length > 0) {
        template.find(".update_user_btn").removeClass("d-none");
      } else {
        template.find(".update_user_btn").addClass("d-none");
      }
    });

    //Disable commands for admin user (serverside blocked)
    if (id == 1) {
      roleElem.attr("disabled", "disabled");
      template.find(".remove_user_btn").addClass("d-none");
    }

    //connect buttons
    template.find(".remove_user_btn").click(function() {
      var r = confirm(
        "You will remove the user " + user.username + " with id " + user.id
      );
      if (r) {
        deleteReq(
          "/users/" + encodeURIComponent(id),
          function(success) {
            template.remove();
          },
          function(err) {
            alert(err.responseText);
          }
        );
      }
    });

    template.find(".update_user_btn").click(function() {
      let username = template.find(".user_name").val();
      let password = template.find(".user_pwd").val(); //template.find(".user_role").val()
      let role = template.find(".user_role").val();
      let data = { username: username, password: password, role: role };

      postAsJson(
        data,
        "/users/" + id,
        function(response) {
          $.getJSON("users", function(users) {
            self.renderUsers(users);
          });
        },
        function(response) {
          alert("Failed to update user " + response);
        },
        false
      );
    });

    template.find(".change_user_pwd_btn").click(function() {
      roleElem.addClass("d-none");
      template.find(".user_pwd").removeClass("d-none");
      template.find(".change_user_pwd_btn").addClass("d-none");
      template.find(".cancel_user_pwd_btn").removeClass("d-none");
    });

    template.find(".cancel_user_pwd_btn").click(function() {
      roleElem.removeClass("d-none");
      template.find(".user_pwd").addClass("d-none");
      template.find(".user_pwd").val("");
      template.find(".cancel_user_pwd_btn").addClass("d-none");
      template.find(".change_user_pwd_btn").removeClass("d-none");
    });

    return template;
  }

  setWorkerEnabled(workerId, enabled) {
    let workerElem = this.workersStatus[workerId];
    if (enabled) {
      workerElem.find(".enable_worker_btn").addClass("hidden");
      workerElem.find(".disable_worker_btn").removeClass("hidden");
      workerElem.find(".remove_worker_btn").addClass("hidden");
      workerElem.find(".enabled_status").removeClass("hidden");
      workerElem.find(".disabled_status").addClass("hidden");
    } else {
      workerElem.find(".enable_worker_btn").removeClass("hidden");
      workerElem.find(".disable_worker_btn").addClass("hidden");
      workerElem.find(".remove_worker_btn").removeClass("hidden");
      workerElem.find(".enabled_status").addClass("hidden");
      workerElem.find(".disabled_status").removeClass("hidden");
    }
  }

  setWorkerStatus(workerId, status) {
    let workerElem = this.workersStatus[workerId];
    if (!workerElem) {
      console.error("Cannot set status on an unknown worker");
      return;
    }
    if (status == "online") {
      workerElem.find(".connect_worker_btn").addClass("hidden");
      workerElem.find(".online_status").removeClass("hidden");
      workerElem.find(".offline_status").addClass("hidden");
    } else {
      workerElem.find(".connect_worker_btn").removeClass("hidden");
      workerElem.find(".offline_status").removeClass("hidden");
      workerElem.find(".online_status").addClass("hidden");
    }
  }

  removeWorker(workerId) {
    let workerElem = this.workersStatus[workerId];
    workerElem.remove();
  }

  appendToContainer(containerId, elem) {
    $(containerId)
      .first()
      .append(elem);
  }
}
