"use strict"

exports.Instance = class Instance {
  constructor(id) {
    this.id = id
    this.users = new Map()
  }
  updateUsers(msg) {
  	var parsed = JSON.parse(msg)
    this.users.forEach(function(user, id) {
      try {
        if(user && (user.id !== parsed.user)) {
          user.send(msg)
        }
      } catch (e) {
        console.log("Socket closed, removing " + user)
        this.users.delete(id)
      }
    }.bind(this))
  }
  addUser(user) {
    user.roomID = this.id
    this.users.set(user.id, user)
  }
}

exports.User = class User {
  constructor(id, socket) {
    this.id = id
    this.ws = socket
    this.roomID = null
  }
  send(msg) {
    this.ws.send(msg)
  }
}

exports.Account = class Account {
  constructor(displayName, sid) {
    this.displayName = displayName
    this.sessionID = sid

  }
}
