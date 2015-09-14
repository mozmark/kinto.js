Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

//class MyAdapter extends Kinto.adapters.BaseAdapter {
class MyAdapter {
  //constructor(dbname, dbconn) {
  constructor(dbname) {
    //super();
    this.dbname = dbname;
    //this.dbconn = dbconn;

    let file = FileUtils.getFile("ProfD", ["kinto.sqlite"]);
    this.dbconn = Services.storage.openDatabase(file);

    // attempt creation
    this.dbconn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS collection_metadata (collection_name TEXT PRIMARY KEY, last_modified INTEGER) WITHOUT ROWID");
    this.dbconn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS collection_data (collection_name TEXT, record_id TEXT, record TEXT);");
    this.dbconn.executeSimpleSQL("CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_record ON collection_data(collection_name, record_id); ");
  }

clear() {
    // clear all of the data for this adapter
    var statement = this.dbconn.createStatement("DELETE FROM collection_data WHERE collection_name = :collection_name;");
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
  }

  create(record) {
    if (record && record.id) {
      // insert a row for this record
      var statement = this.dbconn.createStatement("INSERT INTO collection_data (collection_name, record_id, record) VALUES (:collection_name, :record_id, :record)");
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
    }
    // TODO: If we don't have a record or record ID, throw
  }

  update(record) {
    // update the entry for this record
    if (record && record.id) {
      var statement = this.dbconn.createStatement("UPDATE collection_data SET record = :record WHERE collection_name = :collection_name AND record_id = :record_id");
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
        }
      });
    }
  }

  get(id) {
    // get a record with the specified ID
    if (id) {
      var statement = this.dbconn.createStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
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
          }
        });
      });
    }
  }

  delete(id) {
    if (id) {
      // delete the record with the specified ID
      var statement = this.dbconn.createStatement("DELETE FROM collection_data WHERE collection_name = :collection_name AND record_id = :record_id");
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
        }
      });
    }

    // TODO: throw if there's no id
  }

  list() {
    // list the records
    var statement = this.dbconn.createStatement("SELECT record FROM collection_data WHERE collection_name = :collection_name");
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
        }
      });
    });
  }

  saveLastModified(lastModified) {
    // store the last modified data
    // TODO: ensure lastModified is a number?
    if (lastModified) {
      var statement = this.dbconn.createStatement("REPLACE INTO collection_metadata (collection_name, last_modified) VALUES (:collection_name, :last_modified)");
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
        }
      });
    }

    // TODO: Throw if there's no last modified
  }

  getLastModified() {
    // retrieve the last modified data
    var statement = this.dbconn.createStatement("SELECT last_modified FROM collection_metadata WHERE collection_name = :collection_name");
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
        }
      });
    });
  }
}
