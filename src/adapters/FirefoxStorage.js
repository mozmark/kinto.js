Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

//class MyAdapter extends Kinto.adapters.BaseAdapter {
export default class FirefoxAdapter {
  //constructor(dbname, dbconn) {
  constructor(dbname) {
    //super();
    this.dbname = dbname;
    //this.dbconn = dbconn;

    this.file = FileUtils.getFile("ProfD", ["kinto.sqlite"]);
    //this._dbconn = Services.storage.openDatabase(this.file);

    // attempt creation
    var dbconn = this.getConnection();
    var callback = this.connectionClosed.bind(this);
    //TODO: split into multiple statements, retain single transaction
    var statement = dbconn.createStatement(
        "CREATE TABLE IF NOT EXISTS collection_metadata (collection_name TEXT PRIMARY KEY, last_modified INTEGER) WITHOUT ROWID; "
        +"CREATE TABLE IF NOT EXISTS collection_data (collection_name TEXT, record_id TEXT, record TEXT); "
        +"CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_record ON collection_data(collection_name, record_id); ");

    statement.executeAsync({
      handleError: function(aError) {
        dump("Error: " + aError.message);
      },

      handleCompletion: function(aReason) {
        if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
          dump("Query canceled or aborted!");
        } else {
          dump("Query complete");
        }
      }});
    statement.finalize();
    dbconn.asyncClose(callback);
  }

getConnection() {
  if (!this._dbconn) {
    this._dbconn = Services.storage.openDatabase(this.file);
  }
  return this._dbconn;
}

connectionClosed() {
  dump('connection closed\n');
  this._dbconn = null;
}

clear() {
    // clear all of the data for this adapter
    var dbconn = this.getConnection();
    var callback = this.connectionClosed.bind(this);
    var statement = dbconn.createStatement("DELETE FROM collection_data WHERE collection_name = :collection_name;");
    statement.params.collection_name = this.dbname;

    // execute the statement
    statement.executeAsync({
      handleResult: function(aResultSet) {
        dump("A result set was not expected");
      },

      handleError: function(aError) {
        dump("Error: " + aError.message);
      },

      handleCompletion: function(aReason) {
        if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
          dump("Query canceled or aborted!");
        }
      }
    });
    statement.finalize();
    dbconn.asyncClose(callback);
  }

  create(record) {
    if (record && record.id) {
      // insert a row for this record
      var dbconn = this.getConnection();
      var callback = this.connectionClosed.bind(this);
      var statement = dbconn.createStatement("INSERT INTO collection_data (collection_name, record_id, record) VALUES (:collection_name, :record_id, :record)");
      statement.params.collection_name = this.dbname;
      statement.params.record_id = record.id;
      statement.params.record = JSON.stringify(record);

      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("A result set was not expected");
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
        }
      });
      statement.finalize();
      dbconn.asyncClose(callback);
    }
    // TODO: If we don't have a record or record ID, throw
  }

  update(record) {
    // update the entry for this record
    if (record && record.id) {
      var dbconn = this.getConnection();
      var callback = this.connectionClosed.bind(this);
      var statement = dbconn.createStatement("UPDATE collection_data SET record = :record WHERE collection_name = :collection_name AND record_id = :record_id");
      statement.params.record = JSON.stringify(record);
      statement.params.collection_name = this.dbname;
      statement.params.record_id = record.id;

      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("A result set was not expected");
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
          dbconn.asyncClose(callback);
        }
      });
    }
  }

  get(id) {
    // get a record with the specified ID
    if (id) {
      var dbconn = this.getConnection();
      var callback = this.connectionClosed.bind(this);
      var statement = dbconn.createStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
      statement.params.collection_name = this.dbname;
      statement.params.record_id = id;

      return new Promise(function(resolve, reject) {
        // execute the statement
        statement.executeAsync({
          handleResult: function(aResultSet) {
            dump("result set obtained:\n");
            for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                  let value = row.getResultByName("record");
                  dump(value+"\n");
                  var result = JSON.parse(value);
                  return resolve(result);
                }
            reject("oh noes!");
          },

          handleError: function(aError) {
            dump("Error: " + aError.message);
            reject(aError.message);
          },

          handleCompletion: function(aReason) {
            if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
              dump("Query canceled or aborted!");
            }
            dbconn.asyncClose(callback);
          }
        });
      });
    }
  }

  delete(id) {
    if (id) {
      // delete the record with the specified ID
      var dbconn = this.getConnection();
      var callback = this.connectionClosed.bind(this);
      var statement = dbconn.createStatement("DELETE FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
      statement.params.collection_name = this.dbname;
      statement.params.record_id = id;

      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("A result set was not expected");
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
          dbconn.asyncClose(callback);
        }
      });
    }

    // TODO: throw if there's no id
  }

  list() {
    // list the records
    var dbconn = this.getConnection();
    var callback = this.connectionClosed.bind(this);
    var statement = dbconn.createStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name");
    statement.params.collection_name = this.dbname;

    return new Promise(function(resolve, reject) {
      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("result set obtained:\n");
          var results = [];
          for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                let value = row.getResultByName("record");
                dump(value+"\n");
                results[results.length] = JSON.parse(value);
              }
          resolve(results);
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
          reject(aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
          dbconn.asyncClose(callback);
        }
      });
    });
  }

  saveLastModified(lastModified) {
    // store the last modified data
    // TODO: ensure lastModified is a number?
    if (lastModified) {
      var dbconn = this.getConnection();
      var callback = this.connectionClosed.bind(this);
      var statement = dbconn.createStatement("REPLACE INTO collection_metadata (collection_name, last_modified) VALUES (:collection_name, :last_modified)");
      statement.params.collection_name = this.dbname;
      statement.params.last_modified = lastModified;

      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("A result set was not expected");
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
          dbconn.asyncClose(callback);
        }
      });
    }

    // TODO: Throw if there's no last modified
  }

  getLastModified() {
    // retrieve the last modified data
    var dbconn = this.getConnection();
    var callback = this.connectionClosed.bind(this);
    var statement = dbconn.createStatement("SELECT last_modified FROM collection_metadata WHERE collection_name = :collection_name");
    statement.params.collection_name = this.dbname;

    return new Promise(function(resolve, reject) {
      // execute the statement
      statement.executeAsync({
        handleResult: function(aResultSet) {
          dump("result set obtained:\n");
          for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
                let value = row.getResultByName("last_modified");
                dump(value+"\n");
                var result = JSON.parse(value);
                return resolve(result);
              }
          resolve(undefined);
        },

        handleError: function(aError) {
          dump("Error: " + aError.message);
          reject(aError.message);
        },

        handleCompletion: function(aReason) {
          if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
            dump("Query canceled or aborted!");
          }
          dbconn.asyncClose(callback);
        }
      });
    });
  }
}
