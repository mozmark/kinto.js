//this.EXPORTED_SYMBOLS=["FirefoxAdapter"];
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

function debug(message) {
  dump("FirefoxStorage "+message+"\n\n");
}

class KintoStorage {
  constructor(dbname) {
    this.dbname = dbname;
    this.file = FileUtils.getFile("ProfD", ["kinto.sqlite"]);
    this.statements = {};
  }

  getStatement(statementString) {
    debug("getStatement for "+statementString);
    let statement = this.statements[statementString];
    if (statement) {
      debug("statement exists");
      if (statement.reset) {
        statement.reset();
      }
    } else {
      debug("statement does not exist; creating");
      let dbconn = this.getConnection();
      if (dbconn) {
        statement = dbconn.createAsyncStatement(statementString);
        this.statements[statementString] = statement;
      } else {
        debug("unable to get a database connection");
      }
    }
    return statement;
  }

  getName() {
    return this.dbname;
  }

  getConnection() {
    if (!this._dbconn) {
      this._dbconn = Services.storage.openDatabase(this.file);
    }
    return this._dbconn;
  }

  requestAsyncClose() {
    // ensure all statements are finalized
    for (let statementString in this.statements) {
      debug("finalizing "+statementString);
      this.statements[statementString].finalize();
    }
    // close the connection
    if (this._dbconn) {
      debug("closing the connection");
      this._dbconn.asyncClose(this.connectionClosed.bind(this));
    }
  }

  connectionClosed() {
    debug('connection closed');
    this._dbconn = null;
    this.statements = {};
  }
}

//class MyAdapter extends Kinto.adapters.BaseAdapter {
export default class FirefoxAdapter {
  //constructor(dbname, dbconn) {
  constructor(dbname) {
    //super();
    this.operations = [];
    this.busy = false;


    // attempt creation
    // TODO: should these happen in a single transaction?
    var statements = ["CREATE TABLE IF NOT EXISTS collection_metadata (collection_name TEXT PRIMARY KEY, last_modified INTEGER) WITHOUT ROWID;",
          "CREATE TABLE IF NOT EXISTS collection_data (collection_name TEXT, record_id TEXT, record TEXT);",
          "CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_record ON collection_data(collection_name, record_id);"];

    this.kintoStorage = new KintoStorage(dbname);

    for (var stmt of statements) {
      this.executeUpdate(stmt);
    }
  }

  executeUpdate(sql) {
    debug("requesting to execute statement: "+sql);
    this.executeOperation(function(kintoStorage, callback) {
      debug("executing statement: "+sql);
      var statement = kintoStorage.getStatement(sql);

      statement.executeAsync({
        handleError: function(aError) {
          debug("Error: " + aError.message);
        },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            } else {
              debug("Query complete");
            }
            callback();
          }
      });
    });
  }

  executeOperation(op) {
    debug("executeOperation");
    if (!this.busy) {
      debug("Executing operation now");
      this.busy = true;
      function executeNextOperation() {
        debug("executeNextOperation");
        var next = this.operations.shift();
        if (next) {
          debug("executing queued operation");
          next(this.kintoStorage, executeNextOperation.bind(this));
        } else {
          debug("cleaning up");
          this.busy = false;
          this.kintoStorage.requestAsyncClose();
          debug("work queue complete");
        }
      }
      op(this.kintoStorage, executeNextOperation.bind(this));
    } else {
      debug("queuing operation");
      this.operations.push(op);
    }
  }

  clear() {
    this.executeOperation(function(kintoStorage, callback) {
      debug("kinto::clear");
      // clear all of the data for this adapter
      var statement = kintoStorage.getStatement("DELETE FROM collection_data WHERE collection_name = :collection_name;");
      statement.params.collection_name = kintoStorage.getName();

      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          debug("A result set was not expected");
        },

        handleError: function(aError) {
          debug("Error: " + aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            debug("Query canceled or aborted!");
          }
          callback();
        }
      });
    }.bind(this));
  }

  create(record) {
    if (record && record.id) {
      this.executeOperation(function(kintoStorage, callback) {
        debug("kinto::create");
        // insert a row for this record
        var statement = kintoStorage.getStatement("INSERT INTO collection_data (collection_name, record_id, record) VALUES (:collection_name, :record_id, :record)");
        statement.params.collection_name = kintoStorage.getName();
        statement.params.record_id = record.id;
        statement.params.record = JSON.stringify(record);

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("A result set was not expected");
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            callback();
          }
        });
      }.bind(this));
    }
    // TODO: If we don't have a record or record ID, throw
  }

  update(record) {
    // update the entry for this record
    if (record && record.id) {
      this.executeOperation(function(kintoStorage, callback) {
        debug("kinto::update");
        var statement = kintoStorage.getStatement("UPDATE collection_data SET record = :record WHERE collection_name = :collection_name AND record_id = :record_id");
        statement.params.record = JSON.stringify(record);
        statement.params.collection_name = kintoStorage.getName();
        statement.params.record_id = record.id;

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("A result set was not expected");
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            callback();
          }
        });
      }.bind(this));
    }
  }

  get(id) {
    // get a record with the specified ID
    if (id) {
      debug("kinto::get");

      return new Promise(function(resolve, reject) {
        this.executeOperation(function(kintoStorage, callback) {
          var statement = kintoStorage.getStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
          statement.params.collection_name = kintoStorage.getName();
          statement.params.record_id = id;

          // execute the statement
          statement.executeAsync({
            handleResult: function(aResultSet) {
              debug("result set obtained:");
              for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                let value = row.getResultByName("record");
                debug(value);
                var result = JSON.parse(value);
                return resolve(result);
              }
              reject("oh noes!");
            },

            handleError: function(aError) {
              debug("Error: " + aError.message);
              reject(aError.message);
            },

            handleCompletion: function(aReason) {
              if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                debug("Query canceled or aborted!");
              }
              callback();
            }
          });
        }.bind(this));
      }.bind(this));
    }
  }

  delete(id) {
    if (id) {
      this.executeOperation(function(kintoStorage, callback) {
        debug("kinto::delete");
        // delete the record with the specified ID
        var kintoStorage = this.getConnection();
        var statement = kintoStorage.getStatement("DELETE FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
        statement.params.collection_name = kintoStorage.getName();
        statement.params.record_id = id;

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("A result set was not expected");
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            callback();
          }
        });
      }.bind(this));
    }

    // TODO: throw if there's no id
  }

  list() {
    return new Promise(function(resolve, reject) {
      this.executeOperation(function(kintoStorage, callback){
        debug("kinto::list");

        // list the records
        var statement = kintoStorage.getStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name");
        statement.params.collection_name = kintoStorage.getName();

        var results = [];

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("result set obtained:");
            for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
              let value = row.getResultByName("record");
              debug(value);
              results[results.length] = JSON.parse(value);
            }
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
            reject(aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            } else {
              resolve(results);
            }
            callback();
          }
        });
      }.bind(this));
    }.bind(this));
  }

  saveLastModified(lastModified) {
    // store the last modified data
    // TODO: ensure lastModified is a number?
    if (lastModified) {
      this.executeOperation(function(kintoStorage, callback) {
        var statement = kintoStorage.getStatement("REPLACE INTO collection_metadata (collection_name, last_modified) VALUES (:collection_name, :last_modified)");
        statement.params.collection_name = kintoStorage.getName();
        statement.params.last_modified = lastModified;

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("A result set was not expected");
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            callback();
          }
        });
      }.bind(this));
    }

    // TODO: Throw if there's no last modified
  }

  getLastModified() {
    return new Promise(function(resolve, reject) {
      this.executeOperation(function (kintoStorage, callback){
        // retrieve the last modified data
        var statement = kintoStorage.getStatement("SELECT last_modified FROM collection_metadata WHERE collection_name = :collection_name");
        statement.params.collection_name = kintoStorage.getName();

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("result set obtained:");
            for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                  let value = row.getResultByName("last_modified");
                  debug(value);
                  var result = JSON.parse(value);
                  return resolve(result);
                }
            resolve(undefined);
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
            reject(aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            callback();
          }
        });
      }.bind(this));
    }.bind(this));
  }
}
