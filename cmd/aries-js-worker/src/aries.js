/*
Copyright SecureKey Technologies Inc. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict'

const inNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null
const inBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// base path to load assets from at runtime
const __publicPath = _ => {
    if (inNode) {
        // TODO determine module_path at runtime
        return process.cwd() + "/node_modules/@hyperledger/aries-framework-go/"
    } else if (inBrowser) {
        return "/aries-framework-go/"
    } else {
        // TODO #1127 - throw error or use default?
    }
}

__webpack_public_path__ = __publicPath()

const { _getWorker } = require("worker_loader")

// TODO synchronize access on this map?
const PENDING = new Map()
const NOTIFICATIONS = new Map()
const WORKER = _getWorker(PENDING, NOTIFICATIONS)

// Singleton
let INSTANCE = null

// registers messages in PENDING and posts them to the worker
async function invoke(pkg, fn, arg, msgTimeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(_ => reject(new Error(msgTimeout)), 5000)
        let payload = arg
        if (typeof arg === "string") {
            payload = JSON.parse(arg)
        }
        const msg = newMsg(pkg, fn, payload)
        PENDING.set(msg.id, result => {
            clearTimeout(timer)
            if (result.isErr) {
                reject(new Error(result.errMsg))
            }
            resolve(result.payload)
        })
        WORKER.postMessage(msg)
    })
}

function newMsg(pkg, fn, payload) {
    return {
        // TODO there are several approaches to generate random strings:
        // - which should we implement? do we need cryptographic-grade randomness for this?
        // - alternatively, should the generator be provided by the client?
        id: Math.random().toString(36).slice(2),
        pkg: pkg,
        fn: fn,
        payload: payload
    }
}

// TODO implement Aries options

/**
 * Aries provides Aries SSI-agent functions.
 * @param opts initialization options.
 * @constructor
 */
export const Aries = function(opts) {
    // TODO a constructor that returns a singleton is weird
    if (INSTANCE) {
        return INSTANCE
    }

    INSTANCE = {
        /**
         * Test methods.
         * TODO - remove. Used for testing.
         * @type {{_echo: (function(*=): Promise<String>)}}
         * @private
         */
        _test: {
            /**
             * Returns the input text prepended with "echo: ".
             * TODO - remove.
             * @param text
             * @returns {Promise<String>}
             * @private
             */
            _echo: async function (text) {
                return invoke("test", "echo", text, "timeout while accepting invitation")
            }

        },

        start: async function(opts) {
            return invoke("aries", "Start", opts, "timeout while starting aries")
        },

        stop: async function() {
            return invoke("aries", "Stop", "{}", "timeout while stopping aries")
        },

        waitForNotification : async function waitForNotification(topic) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(_ => resolve(), 10000)
                NOTIFICATIONS.set(topic, result => {
                    if (result.isErr) {
                        reject(new Error(result.errMsg))
                    }
                    resolve(result.payload)
                })
            });
        },

        didexchange: {
            pkgname: "didexchange",
            createInvitation: async function (text) {
                return invoke(this.pkgname, "CreateInvitation", text, "timeout while creating invitation")
            },
            receiveInvitation: async function (text) {
                return invoke(this.pkgname, "ReceiveInvitation", text, "timeout while receiving invitation")
            },
            acceptInvitation: async function (text) {
                return invoke(this.pkgname, "AcceptInvitation", text, "timeout while accepting invitation")
            },
            acceptExchangeRequest: async function (text) {
                return invoke(this.pkgname, "AcceptExchangeRequest", text, "timeout while accepting exchange request")
            },
            createImplicitInvitation: async function (text) {
                return invoke(this.pkgname, "CreateImplicitInvitation", text, "timeout while creating implicit invitation")
            },
            removeConnection: async function (text) {
                return invoke(this.pkgname, "RemoveConnection", text, "timeout while removing invitation")
            },
            queryConnectionByID: async function (text) {
                return invoke(this.pkgname, "QueryConnectionByID", text, "timeout while querying connection by ID")
            },
            queryConnections: async function (text) {
                return invoke(this.pkgname, "QueryConnections", text, "timeout while querying connections")
            }
        },

        messaging: {
            pkgname: "messaging",
            registeredServices: async function (text) {
                return invoke(this.pkgname, "RegisteredServices", text, "timeout while getting list of registered services")
            },
            registerMessageService: async function (text) {
                return invoke(this.pkgname, "RegisterMessageService", text, "timeout while registering service")
            },
            registerHTTPMessageService: async function (text) {
                return invoke(this.pkgname, "RegisterHTTPMessageService", text, "timeout while registering HTTP service")
            },
            unregisterMessageService: async function (text) {
                return invoke(this.pkgname, "UnregisterMessageService", text, "timeout while unregistering service")
            },
            sendNewMessage: async function (text) {
                return invoke(this.pkgname, "SendNewMessage", text, "timeout while sending new message")
            },
            sendReplyMessage: async function (text) {
                return invoke(this.pkgname, "SendReplyMessage", text, "timeout while sending reply message")
            }
        },

        vdri: {
            pkgname: "vdri",
            createPublicDID: async function (text) {
                return invoke(this.pkgname, "CreatePublicDID", text, "timeout while creating public DID")
            },
        },

        router: {
            pkgname: "router",
            register: async function (text) {
                return invoke(this.pkgname, "Register", text, "timeout while registering router")
            },
            unregister: async function (text) {
                return invoke(this.pkgname, "Unregister", text, "timeout while registering router")
            }
        }
    }

    return INSTANCE

}
