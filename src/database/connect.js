import mongoose from "mongoose";

let connected = false;

export async function connectMongo({ uri, dbName }) {
  if (connected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    dbName,
    autoIndex: true
  });

  connected = true;
  return mongoose.connection;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connected = false;
}

export { mongoose };
