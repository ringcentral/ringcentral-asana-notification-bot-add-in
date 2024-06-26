const { extendApp } = require('ringcentral-chatbot-core');
const { botHandler } = require('./handlers/botHandler');
const axios = require('axios');
const authorizationHandler = require('./handlers/authorizationHandler');
const notificationHandler = require('./handlers/notificationHandler');
const interactiveMessageHandler = require('./handlers/interactiveMessageHandler');

const { AsanaUser } = require('./models/asanaUserModel');
const { Subscription } = require('./models/subscriptionModel');
const { RcUser } = require('./models/rcUserModel');

// extends or override express app as you need
exports.appExtend = (app) => {
    const skills = [];
    const botConfig = {
        adminRoute: '/admin', // optional
        botRoute: '/bot', // optional
        models: { // optional
            AsanaUser,
            Subscription,
            RcUser
        }
    }

    extendApp(app, skills, botHandler, botConfig);

    if (process.env.NODE_ENV !== 'test') {
        app.listen(process.env.PORT || process.env.RINGCENTRAL_CHATBOT_EXPRESS_PORT);
    }

    console.log('server running...');
    console.log(`bot oauth uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${botConfig.botRoute}/oauth`);

    app.get('/is-alive', (req, res) => { res.send(`OK`); });
    app.get('/ping-api', async (req, res) => { 
        const apiInfoResp = await axios.get('https://api-xmrupxmn.int.rclabenv.com/restapi'); 
        res.json(apiInfoResp.data)
    });
    
    app.get('/oauth-callback', authorizationHandler.oauthCallback);
    app.post('/notification', notificationHandler.notification);
    app.post('/interactive-messages', interactiveMessageHandler.interactiveMessages);
}