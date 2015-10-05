//this.EXPORTED_SYMBOLS=["FirefoxAdapter"];
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

function debug(message) {
  dump("FirefoxStorage "+message+"\n\n");
}

//class MyAdapter extends Kinto.adapters.BaseAdapter {
export default class FirefoxAdapter {
  //constructor(dbname, dbconn) {
  constructor(dbname) {
    //super();
    this.dbname = dbname;
    this.operations = [];
    this.busy = false;

    this.file = FileUtils.getFile("ProfD", ["kinto.sqlite"]);

    // attempt creation
    // TODO: should these happen in a single transaction?
    var statements = ["CREATE TABLE IF NOT EXISTS collection_metadata (collection_name TEXT PRIMARY KEY, last_modified INTEGER) WITHOUT ROWID;",
          "CREATE TABLE IF NOT EXISTS collection_data (collection_name TEXT, record_id TEXT, record TEXT);",
          "CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_record ON collection_data(collection_name, record_id);"];

    for (var stmt of statements) {
      this.executeUpdate(stmt);
    }
  }

executeUpdate(sql) {
   debug("requesting to execute statement: "+sql);
   this.executeOperation(function(dbconn, callback) {
      debug("executing statement: "+sql);
      var statement = dbconn.createAsyncStatement(sql);

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
          statement.finalize();
          callback();
        }
      });
    }.bind(this));
}

executeOperation(op) {
  debug("executeOperation");
  if (!this.busy) {
    debug("Executing operation now");
    var dbconn = this.getConnection();
    var callback = this.connectionClosed.bind(this);
    this.busy = true;
    function executeNextOperation() {
      debug("executeNextOperation");
      var next = this.operations.shift();
      if (next) {
        debug("executing queued operation");
        next(dbconn, executeNextOperation.bind(this));
      } else {
        debug("cleaning up");
        this.busy = false;
        dbconn.asyncClose(callback);
        debug("work queue complete");
      }
    }
    op(dbconn, executeNextOperation.bind(this));
  } else {
    debug("queuing operation");
    this.operations.push(op);
  }
}

getConnection() {
  if (!this._dbconn) {
    this._dbconn = Services.storage.openDatabase(this.file);
  }
  return this._dbconn;
}

connectionClosed() {
  debug('connection closed');
  this._dbconn = null;
}

clear() {
  this.executeOperation(function(dbconn, callback) {
    debug("kinto::clear");
    // clear all of the data for this adapter
    var dbconn = this.getConnection();
    var statement = dbconn.createAsyncStatement("DELETE FROM collection_data WHERE collection_name = :collection_name;");
    statement.params.collection_name = this.dbname;

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
        statement.finalize();
        callback();
      }
    });
  }.bind(this));
}

  create(record) {
    if (record && record.id) {
        this.executeOperation(function(dbconn, callback) {
        debug("kinto::create");
        // insert a row for this record
        var statement = dbconn.createAsyncStatement("INSERT INTO collection_data (collection_name, record_id, record) VALUES (:collection_name, :record_id, :record)");
        statement.params.collection_name = this.dbname;
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
            statement.finalize();
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
      this.executeOperation(function(dbconn, callback) {
        debug("kinto::update");
        var statement = dbconn.createAsyncStatement("UPDATE collection_data SET record = :record WHERE collection_name = :collection_name AND record_id = :record_id");
        statement.params.record = JSON.stringify(record);
        statement.params.collection_name = this.dbname;
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
            statement.finalize();
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
        this.executeOperation(function(dbconn, callback) {
          var statement = dbconn.createAsyncStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
          statement.params.collection_name = this.dbname;
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
              statement.finalize();
              callback();
            }
          });
        }.bind(this));
      }.bind(this));
    }
  }

  delete(id) {
    if (id) {
      this.executeOperation(function(dbconn, callback) {
        debug("kinto::delete");
        // delete the record with the specified ID
        var dbconn = this.getConnection();
        var statement = dbconn.createAsyncStatement("DELETE FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
        statement.params.collection_name = this.dbname;
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
            statement.finalize();
            callback();
          }
        });
      }.bind(this));
    }

    // TODO: throw if there's no id
  }

  list() {
    return new Promise(function(resolve, reject) {
      this.executeOperation(function(dbconn, callback){
        debug("kinto::list");

        // list the records
        var statement = dbconn.createAsyncStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name");
        statement.params.collection_name = this.dbname;

        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            debug("result set obtained:");
            var results = [];
            for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                  let value = row.getResultByName("record");
                  debug(value);
                  results[results.length] = JSON.parse(value);
                }
            resolve(results);
          },

          handleError: function(aError) {
            debug("Error: " + aError.message);
            reject(aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              debug("Query canceled or aborted!");
            }
            statement.finalize();
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
      this.executeOperation(function(dbconn, callback) {
        var statement = dbconn.createAsyncStatement("REPLACE INTO collection_metadata (collection_name, last_modified) VALUES (:collection_name, :last_modified)");
        statement.params.collection_name = this.dbname;
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
            statement.finalize();
            callback();
          }
        });
      }.bind(this));
    }

    // TODO: Throw if there's no last modified
  }

  getLastModified() {
    return new Promise(function(resolve, reject) {
      this.executeOperation(function (dbconn, callback){
        // retrieve the last modified data
        var statement = dbconn.createAsyncStatement("SELECT last_modified FROM collection_metadata WHERE collection_name = :collection_name");
        statement.params.collection_name = this.dbname;

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
            statement.finalize();
            callback();
          }
        });
      }.bind(this));
    }.bind(this));
  }
}
