"use strict"
var http = require('http');
var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({"port":8080});

var connect = require("connect");
var serveStatic = require("serve-static");
connect().use(serveStatic("/home/ubuntu/sketchy")).listen(80);

class Instance {
  constructor() {
    this.roomID = makeid()
    this.users = new Array()
  }

  updateUsers(msg) {
    users.forEach(function(user) {
      user.send(msg)
    })
  }

  addUser(user) {
    this.users.push(user)
  }
}

class User {
  constructor(socket) {
    this.sessionID = makeid()
    this.ws = socket
  }

  send(msg) {
    this.ws.send(msg)
  }
}

var makeid = function() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  do {
    for (var i=0; i < 5; ++i){
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  } while (ids.indexOf(text) !== -1);
  return text;
};

var ids = new Array();
var connections = new Array();

var Type = {
  "DRAW" : 0,
  "ERASE" : 1,
  "UNDO" : 2,
  "REDO" : 3,
  "CLEAR" : 4
}

wss.on("connection", function(ws){
  var id = makeid();
  ids.push(id);
  connections.push(ws);
  ws.send(JSON.stringify({"type":"assign-id","body":id}));
  ws.on("message", function(message){
  message = JSON.parse(message);
    if (message.type === Type.DRAW || message.type === Type.UNDO || message.type === Type.REDO) {
      console.log("stroke recieved");
      ids.forEach(function(id, i){
        if(message.user !== ids[i]){
          console.log("stroke sent to ", ids[i]);
          try {
            connections[i].send(JSON.stringify(message));
          } catch (e) {
            console.log(e);
          }
        }
      });
    } 
  });
});

