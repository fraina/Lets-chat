import React, { Component } from 'react'
import Centrifuge from 'centrifuge'
import Chance from 'chance'
import jsSHA from 'jssha'
import moment from 'moment'
import _ from 'lodash'
import './App.css'

var chance = new Chance()
var subscription

export default class App extends Component {
  constructor() {
    super()
    this.state = {
      message: [],
      isLoading: true,
      text: ''
    }

    this.secret = process.env.REACT_APP_WS_SECRET
    this.randomName = chance.name()
    this.dialogNode = null
    this.online = 0
  }

  componentDidMount() {
    this.centrifuge = this.conn()

    this.centrifuge.on('connect', function(context) {
      const name = this.randomName
      this.addBlob(`connected with ID ${name}`)
      this.subscribe(name, this.centrifuge)
    }.bind(this))

    this.centrifuge.on('disconnect', function(context) {
        // do whatever you need in case of disconnect from server
        console.log('disconnect: ', context)
    })

    this.setState({ isLoading: false })
    this.centrifuge.connect()
  }
  
  componentDidUpdate() {
    this.dialogNode.scrollTop = this.dialogNode.scrollHeight
  }

  conn() {
    const timestamp = parseInt(new Date().getTime()/1000, 10).toString()
    
    const name = this.randomName
    const info = JSON.stringify({"name": name})
    var hmacBody = name + timestamp + info
    var shaObj = new jsSHA("SHA-256", "TEXT")
    shaObj.setHMACKey(this.secret, "TEXT")
    shaObj.update(hmacBody)
    var token = shaObj.getHMAC("HEX")

    return new Centrifuge({
      url: `${process.env.REACT_APP_WS_PROTOCAL}://${process.env.REACT_APP_WS_HOST}:${process.env.REACT_APP_WS_PORT}`,
      user: name,
      timestamp: timestamp,
      token: token,
      info: info,
      debug: true
    })
  }

  subscribe(randomName, centrifuge) {
    subscription = centrifuge.subscribe('public:chat', function(message) {
      if (message.data) {
        this.addBlob(message.data.message, message.data.from)
      }
    }.bind(this))

    subscription.on('subscribe', function(context) {
      this.addBlob("subscribed on channel chat")
    }.bind(this))
    
    subscription.presence().then(function(message) {
      const count = _.size(message.data)
      this.online = count
      console.log('presence message: ', message)
      this.addBlob('now connected ' + count + ' clients')
    }.bind(this), function(err) {})
    
    subscription.on('join', function(message) {
      console.log('join message: ', message)
      if (message.data.user !== this.randomName) {
        this.online++
      }
      this.addBlob(`${message.data.user} joined channel`)
    }.bind(this))

    subscription.on('leave', function(message) {
      console.log('leave message: ', message)
      this.online--
      this.addBlob(`${message.data.user} left channel`)
    }.bind(this))
  }

  addBlob(message, from) {
    this.state.message.push({
      from: from ? from : 'system',
      message: message,
      receiveTime: moment().format('HH:mm a'),
      hash: chance.geohash()
    })
    this.forceUpdate()
  }

  newMessage() {
    // publish
    var data = {
      from: JSON.stringify(this.randomName),
      message: this.state.text
    }
    this.setState({ text: '' })
    subscription.publish(data)
  }

  onEnterMsg(e) {
    this.setState({ text: e.target.value })
  }

  onPressEnter(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.state.text.length > 0 && this.newMessage()
    }
  }

  renderMsg() {
    var ary = []
    for (var i = 0; i < this.state.message.length; i++) {
      const blob = this.state.message[i]
      if (blob.from === 'system') {
        ary.push(this.renderSystemMsg(blob.message))
      } else {
        ary.push(this.renderUserMsg(blob))
      }
    }
    return ary
  }

  renderSystemMsg(message) {
    return (
      <div className="chat is-system" key={message}>
        <span>{message}</span>
      </div>
    )
  }

  renderUserMsg(blob) {
    const { from, message, receiveTime, hash } = blob
    const parseName = JSON.parse(from)
    const icon = parseName.charAt(0)

    return (
      <div className={`chat ${parseName === this.randomName ? 'is-me' : 'is-others'}`} key={hash}>
        <div className="chat-userIcon">{icon}</div>
        <div className="chat-wrapper">
          <div className="chat-userName">{parseName}</div>
          <div className="chat-message">
            <p>{message}</p>
          </div>
          <div className="chat-time">{receiveTime}</div>
        </div>
      </div>
    )
  }

  render() {
    return (
      <div className="chatroom">
        <div className="chatroom-info">
          <span className="chatroom-title">Chatroom ({this.online})</span>
        </div>
        <div className="chatroom-dialog" ref={(c) => this.dialogNode = c}>
          {this.renderMsg()}
        </div>
        <div className="chatroom-input">
          <textarea 
            className="chatroom-textarea" 
            onChange={this.onEnterMsg.bind(this)}
            placeholder="Message"
            value={this.state.text}
            onKeyPress={this.onPressEnter.bind(this)}
          />
          <button 
            disabled={this.state.text.length === 0}
            className="chatroom-submit" 
            type="submit"
            onSubmit={this.newMessage.bind(this)}
            onClick={this.newMessage.bind(this)}
          >Send</button>
        </div>
      </div>
    )
  }
}
