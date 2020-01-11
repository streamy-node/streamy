var app = require("../app");
var http = require("http");
var expect = require("chai").expect;
var assertTestDatabase = require("./test_utils").assertTestDatabase;

describe("App tests", function() {
  before(function() {
    //! force database to contains the keyword test to avoid to touch prod db
    assertTestDatabase();
  });

  it("Initialize streamy", async function() {
    this.timeout(10000);
    var server = http.createServer(app);
    var io = require("socket.io").listen(server);
    var result = await app.initialize("configs/config.yaml", io);
    expect(result).to.be.true;
  });
});
