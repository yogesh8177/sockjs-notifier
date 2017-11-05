import { EventEmitter } from 'events';
import {emitter} from './eventListeners';
import * as constants from './eventConstants';
import {isUserValid} from './authenticate';
import {isMessageValid, prepareMessage} from './utility';
import { fetchMessagesForUser } from './mongoDB';

//let emitter = null;
/*
    @param:conn - socket connection
    Note: If emitter is null, then you forgot to call registerListeners from ./eventListeners file inside sockJS file.
*/

let messageHandlers = (conn, connectionToUserMapping, message, users) => {
    let messageObject = prepareMessage(message, 'client'); // second argument says message obtained from client
    if(isMessageValid(messageObject)) {
        let { userId } = messageObject;

        // Create a function to act as an auth middleware. Check userId/token to authenticate.
        // eg: auth(userId);

        switch (messageObject.event) {
            case constants.USER_AUTHENTICATE:
                isUserValid(userId)
                .then(() => {
                    addToUsersList(users, userId, conn.id, connectionToUserMapping);
                    emitter.emit(constants.USER_AUTHENTICATED, conn);
                    //users[userId] = conn.id;
                    //fetchFromDBAndNotify(conn, userId); // fetch previous notifications from database that were not delivered due to client was not connected!
                    console.log(users);
                })
                .catch(() => {
                    emitter.emit(constants.AUTH_ERROR, conn);
                });
            break;

            case constants.USER_AUTHENTICATED:
                emitter.emit(constants.USER_AUTHENTICATED, conn);
            break;

            case constants.USER_FETCH_NOTIFICATION_HISTORY:
                emitter.emit(constants.USER_FETCH_NOTIFICATION_HISTORY, { conn, userId });
            break;

            case constants.NOTIFICATION_RECEIVED_ACK:
                let messageId = messageObject.messageId;
                emitter.emit(constants.NOTIFICATION_RECEIVED_ACK, { conn, messageId });
            break;

            case constants.NOTIFICATION_BULK_RECEIVED_ACK:
                let messageIds = messageObject.messageIds;
                emitter.emit(constants.NOTIFICATION_BULK_RECEIVED_ACK, { conn, messageIds });
            break;

            case constants.INVALID_JSON:
                emitter.emit(constants.INVALID_JSON, conn);
            break;

            case constants.AUTH_ERROR: 
                emitter.emit(constants.AUTH_ERROR, conn);
            break;

            default:
                console.log('default case', messageObject);
            break;
        }
        
    }else{
        console.log('Invalid message', messageObject);
    }
}

let addToUsersList = (users, userId, socketId, connectionToUserMapping) => {
    if (users[userId]) {
        users[userId].push(socketId);
        connectionToUserMapping[socketId] = userId;
    }else {
        users[userId] = [];
        users[userId].push(socketId);
        connectionToUserMapping[socketId] = userId;
    }
    console.log('Total users', users);
}
// load data from history and notify the clients that connected now!
let fetchFromDBAndNotify = (conn, userId) => {
    console.log('fetching from db...');
    return new Promise((resolve, reject) => {
        fetchMessagesForUser(userId)
        .then((messages) => {
            console.log(messages);
            // todo: improvement for sending it as a bulk notificaton!
            if (Array.isArray(messages)) {
                messages.forEach((message) => {
                    conn.write(JSON.stringify(message));
                });
                return resolve();
            }else {
                console.log('MongoDB Error while fetching notifications for', userId);
            }
        })
        .catch((error) => {
            return reject(error); 
        });
    });
}

export default messageHandlers;