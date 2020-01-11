var assert = require("chai").assert;

function assertTestDatabase() {
  assert.ok(
    //! force database to contains the keyword test to avoid to touch prod db
    process.env.MYSQL_DATABASE && process.env.MYSQL_DATABASE.includes("test"),
    "You need a SQL database with the word 'test' in it to prevent to mess with production. Use the environment variables STREAMY_DB_* to configure your test db (cf CI)"
  );
}

exports.assertTestDatabase = assertTestDatabase;
