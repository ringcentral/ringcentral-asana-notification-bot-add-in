const { Subscription } = require('../models/subscriptionModel');
const { AsanaUser } = require('../models/asanaUserModel');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const cardBuilder = require('../lib/cardBuilder');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const asana = require('asana');
const { Analytics } = require('../lib/analytics');

const MAX_TASK_DESC_LENGTH = 200;

async function notification(req, res) {
    try {
        const { query, body } = req;
        await sendNotification(query, body);
    }
    catch (e) {
        console.error(e?.status);
        console.error(e?.message);
    }
    // required by Asana for handshake (https://developers.asana.com/docs/webhooks)
    if (req.headers['x-hook-secret']) {
        res.header('X-Hook-Secret', req.headers['x-hook-secret']);
    }

    res.status(200);
    res.json({
        result: 'OK',
    });
}

async function sendNotification(query, body) {
    // Identify which user or subscription is relevant, normally by 3rd party webhook id or user id. 
    const subscriptionId = query.subscriptionId;
    const subscription = await Subscription.findByPk(subscriptionId);

    if (!subscription) {
        return;
    }

    const incomingEvents = body.events;
    if (incomingEvents) {
        const asanaUserId = subscription.asanaUserId;
        const asanaUser = await AsanaUser.findByPk(asanaUserId.toString());
        const bot = await Bot.findByPk(asanaUser.botId);
        const analytics = new Analytics({
            mixpanelKey: process.env.MIXPANEL_KEY,
            secretKey: process.env.ANALYTICS_SECRET_KEY,
            userId: bot.id,
            accountId: bot.token && bot.token.creator_account_id,
        });
        // check token refresh condition
        await checkAndRefreshAccessToken(asanaUser);
        const client = asana.Client.create({ "defaultHeaders": { "Asana-Enable": "new_user_task_lists" } }).useAccessToken(asanaUser.accessToken);
        for (const event of incomingEvents) {
            // changes from user self doesn't generate a notification
            if (event.user && event.user.gid == asanaUser.id) {
                continue;
            }
            const byUser = await client.users.findById(event.user.gid);
            // task -> resource.gid == taskId; comment -> parent.gid == taskId
            const task = await client.tasks.findById(event.resource.resource_type == 'task' ? event.resource.gid : event.parent.gid);
            if (!task.followers.map(f => f.gid).includes(asanaUser.id)) {
                continue;
            }
            const taskName = task.name;
            const taskDescription = task.notes.length > MAX_TASK_DESC_LENGTH ?
                task.notes.substring(0, MAX_TASK_DESC_LENGTH) + '...' :
                task.notes;
            const projectNames = task.projects.map(p => p.name).toString();
            let customFields = [];
            if (task.custom_fields) {
                for (const customField of task.custom_fields) {
                    if (customField.display_value) {
                        customFields.push({
                            title: customField.name,
                            value: customField.display_value
                        });
                    }
                }
            }
            const taskDueDate = task.due_on;
            const username = byUser.name;
            const userEmail = byUser.email;
            const taskLink = task.permalink_url;
            if (event.resource.resource_type == 'task') {
                // get task info
                // case.1: New Task assigned to me: get user_task_list and only under that parent    
                if (event.parent && event.parent.gid == asanaUser.userTaskListGid) {
                    if (event.action == 'added') {
                        const newTaskAssignedCard = cardBuilder.newTaskAssignedCard(taskName, taskDescription, projectNames, taskDueDate, username, userEmail, taskLink, customFields);
                        await bot.sendAdaptiveCard(subscription.groupId, newTaskAssignedCard);
                        await analytics.trackBotAction('cardPosted', {
                          chatId: subscription.groupId,
                        });
                    }
                }
                // COMMENTED: unconfirmed use case
                // case.2: My Task due change
                // else if (event.change && event.change.field == 'due_on') {
                //     const taskDueDateChangeCard = cardBuilder.taskDueDateChangeCard(taskName, taskDescription, projectNames, taskDueDate, username, userEmail, taskLink);
                //     await bot.sendAdaptiveCard(subscription.groupId, taskDueDateChangeCard);
                // }
            }
            // case.3: New Comment under My Task (except my own comment)
            else if (event.resource.resource_type == 'story' && event.resource.resource_subtype == 'comment_added') {
                // get comment info   
                const commentStory = await client.stories.findById(event.resource.gid);

                // trying to replace mention user string back to it, from user task list link, but not always working
                let commentWithMentions = commentStory.text;
                const mentionRegex = new RegExp('https://app.asana.com/0/(.{1,20})/list', 'g');
                const userTaskListIds = commentStory.text.matchAll(mentionRegex);
                for (const userTaskListId of userTaskListIds) {
                    const userTaskList = await client.userTaskLists.findById(userTaskListId[1]);
                    if (userTaskList) {
                        commentWithMentions = commentWithMentions.replace(`https://app.asana.com/0/${userTaskListId[1]}/list`, `@${userTaskList.owner.name}`);
                    }
                }
                const newCommentCard = cardBuilder.newCommentCard(bot.id, taskName, taskLink, commentWithMentions, username, userEmail, task.gid, event.user.gid);
                await bot.sendAdaptiveCard(subscription.groupId, newCommentCard);
                await analytics.trackBotAction('cardPosted', {
                  chatId: subscription.groupId,
                });
            }
        }
    }
}

// sent to all users
async function announcement(req, res) {
    try {
        const { query, body } = req;
    }
    catch (e) {
        console.error(e?.status);
        console.error(e?.message);
    }
    res.status(200);
    res.json({
        result: 'OK',
    });
}

exports.notification = notification;
exports.announcement = announcement;