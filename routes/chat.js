/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const chatController = require('../controllers/chat');

router.post('/sendChatRequest', [
    check('astrologer_id', 'Astrologer id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('sendChatRequest')], (req, res, next) => {
    chatController.sendChatRequest(req, res);
});

router.post('/acceptChatRequest', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('acceptChatRequest')], (req, res, next) => {
  chatController.acceptChatRequest(req, res);
});

router.post('/denyChatRequest', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('denyChatRequest')], (req, res, next) => {
  chatController.denyChatRequest(req, res);
});

router.post('/chatListing', [auth.authenticateUser, auth.isAuthenticated('chatListing')], (req, res, next) => {
  chatController.chatListing(req, res);
});

router.post('/getChatToken', [auth.authenticateUser, auth.isAuthenticated('getChatToken')], (req, res, next) => {
  chatController.getChatToken(req, res);
});

router.get('/getChatToken', /*[auth.authenticateUser, auth.isAuthenticated('getChatToken')],*/ (req, res, next) => {  
  chatController.getChatToken(req, res);
});

router.post('/chatCallback', (req, res, next) => {  
  chatController.chatCallback(req, res);
});

router.post('/deleteChannel', (req, res, next) => {  
  chatController.deleteChannel(req, res);
});

router.post('/endChat', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('endChat')], (req, res, next) => {  
  chatController.endChat(req, res);
});

router.post('/chatDetails', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('chatDetails')], (req, res, next) => {  
  chatController.chatDetails(req, res);
});

router.post('/messageListing', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('messageListing')], (req, res, next) => {  
  chatController.messageListing(req, res);
});

router.post('/getOngoingChat', [auth.authenticateUser, auth.isAuthenticated('getOngoingChat')], (req, res, next) => {  
  chatController.getOngoingChat(req, res);
});

router.post('/deleteMissedChat', (req, res, next) => {  
  chatController.deleteMissedChat(req, res);
});

router.post('/endChatOnBalance', (req, res, next) => {  
  chatController.endChatOnBalance(req, res);
});

router.post('/updateChatPage', [auth.authenticateUser, auth.isAuthenticated('updateChatPage')], (req, res, next) => {  
  chatController.updateChatPage(req, res);
});

router.post('/cancelChatRequest', [
  check('chat_id', 'Chat id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('cancelChatRequest')], (req, res, next) => {  
  chatController.cancelChatRequest(req, res);
});

module.exports = router;