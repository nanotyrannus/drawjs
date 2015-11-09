"use strict"
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 80;
var WebSocketServer = require("ws").Server
var wss = new WebSocketServer({"port" : 8080})

var instances = new Map()
var users = new Array()
var ids = new Map()

class Instance {
  constructor(id) {
    this.id = id
    this.users = new Map()
  }
  updateUsers(msg) {
    this.users.forEach(function(user, index, array) {
      var parsed = JSON.parse(msg)
      console.log(msg + " <--unparsed")
      try {
        if(user && (user.id !== parsed.user)) {
          user.send(msg)
        }
      } catch (e) {
        console.log("Socket closed, removing " + user)
        array[index] = null
      }
    })
  }
  addUser(user) {
    user.roomID = this.id
    this.users.set(user.id, user)
  }
}
class User {
  constructor(id, socket) {
    this.id = id
    this.ws = socket
    this.roomID = null
  }
  send(msg) {
    this.ws.send(msg)
  }
}

var randomInteger = function(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var generateID = function(length) {
  var id;
  do {
    id = "";
    for (var i = 0; i < length; ++i) {
      id += String.fromCharCode(randomInteger(65, 90))
    }
  } while (ids.has(id));
  ids.set(id, true)
  return id;
}

var serveID = function(resObj, fileName, id) {
  fs.readFile(process.cwd() + fileName, "binary", function(err, file) {
    if (err) {
      resObj.writeHead(500, {"Content-type" : "text/plain"})
      resObj.write("500" + err)
    } else {
      resObj.writeHead(200)
      resObj.write(file, "binary")
      if (id) {
        resObj.end("<script>var roomID = \"" + id + "\"</script>")
      } else {
        resObj.end()
      }
    }
  })
}

var Type = {
  "DRAW" : 0,
  "ERASE" : 1,
  "UNDO" : 2,
  "REDO" : 3,
  "CLEAR" : 4,
  "JOIN" : 5,
  "ASSIGNMENT" : 6
}

wss.on("connection", function(ws) {
  var connectingUser = new User(generateID(10), ws)
  users.push(connectingUser)
  connectingUser.send(JSON.stringify({
    "type" : Type.ASSIGNMENT,
    "body" : connectingUser.id
  }))
  ws.on("message", function (msg) {
    var parsed = JSON.parse(msg)
    if (parsed.type === Type.JOIN) {
      console.log("Adding user " + connectingUser.id + " to room " + parsed.body)
      instances.get(parsed.body).addUser(connectingUser)
    } else if (parsed.type !== Type.JOIN) {
      console.log(connectingUser.id, " ", parsed.type, " ")
      instances.get(connectingUser.roomID).updateUsers(msg)
    }
  })
})

http.createServer(function(request, response) {
  console.log(request.url)
  var appRequest = request.url.split("?")
  var instance = null
  if(appRequest[0] === "/sketchy" && !appRequest[1]) {
    instance = new Instance(generateID(10))
    instances.set(instance.id, instance)
    serveID(response, "/main.html", instance.id)
    console.log("NEW INSTANCE")
    return;
  } else if (appRequest[0] === "/sketchy"){
    request.url = "/main.html"
  }

  var uri = url.parse(request.url).pathname
  var filename = path.join(process.cwd(), uri)

  fs.exists(filename, function(exists) {
    if (!exists) {
      response.writeHead(404, {"Content-Type" : "text/plain"})
      response.end("404\n")
      return;
    }

    //if |filename| is a directory, serve index.html in that directory
    if (fs.statSync(filename).isDirectory()) {
      filename += "/index.html"
    }

    fs.readFile(filename, "binary", function(err, file) {
      if (err) {
        response.writeHead(500, {"Content-Type" : "text/plain"})
        response.end("500" + err)
        return
      } else {
        response.writeHead(200)
        if(filename == (process.cwd() + "/main.js") && instance) {
          response.write("var roomID = " + instance.id)
        }
        response.write(file, "binary")
        response.end()
      }
    })
  })
}).listen(port)
