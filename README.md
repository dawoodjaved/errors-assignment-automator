# Airbrake Assignment Automator

A comprehensive Google Apps Script automation tool that monitors Airbrake errors, creates Redmine tickets, and manages error assignments through Slack integration.

## 🚀 Features

- **Automated Error Monitoring**: Fetches Airbrake errors every 6 hours
- **Smart Alerting**: Sends Slack notifications for different error severity levels
- **Redmine Integration**: Automatically creates and updates Redmine tickets
- **Slack Workflow**: Interactive user assignment through Slack dropdowns
- **Google Sheets Management**: Maintains error tracking and assignment history
- **Automated Cleanup**: Removes resolved errors and updates statuses
- **Multi-platform Support**: Handles EZO, AS, EZR, and CMMS platforms

## 📋 Prerequisites

- Google Apps Script access
- Airbrake API key and project ID
- Redmine API key and instance URL
- Slack Bot Token and Webhook URL
- Google Sheets with proper column structure

## 🛠️ Setup

### 1. Environment Configuration

Set up the following script properties in Google Apps Script:

```javascript
AIRBRAKE_API_KEY=your_airbrake_api_key
SLACK_WEBHOOK_URL=your_slack_webhook_url
SLACK_CHANNEL_ID=your_channel_id
SLACK_BOT_TOKEN=your_slack_bot_token
REDMINE_API_KEY=your_redmine_api_key
SHEET_ID=your_google_sheet_id
ALLOWED_USERS_TO_ASSIGN_ARIBRAKES=comma_separated_user_list
```

### 2. Google Sheets Structure

The script expects the following columns in your main sheet:

| Column | Purpose |
|--------|---------|
| Airbrake ID | Unique identifier for each error |
| Product | Platform (EZO, AS, EZR, CMMS) |
| Airbrake URL | Link to the error in Airbrake |
| Message | Error message description |
| Occurrence Count | Current number of occurrences |
| Previous Occurrence Count | Previous occurrence count |
| Resolved Status | Whether the error is resolved |
| Assigned RM Ticket ID | Redmine ticket ID |
| RM Status | Current Redmine ticket status |
| Assigned To | User assigned to the error |
| Day Assigned | Date when error was assigned |
| Days Open | Number of days since first occurrence |
| Last Updated | Last update timestamp |
| Slack Thread ID | Slack thread for discussions |
| Muted | Whether error notifications are muted |
| First Notice At | First occurrence timestamp |
| Last Notice At | Most recent occurrence timestamp |

### 3. Slack App Configuration

1. Create a Slack app with the following permissions:
   - `chat:write`
   - `users:read`
   - `channels:read`
   - `groups:read`
   - `im:read`
   - `mpim:read`

2. Install the app to your workspace
3. Add the bot to your target channels

## 🔧 Installation

1. Copy the script to Google Apps Script
2. Set up all required script properties
3. Run the `setupTriggers()` function once to configure automated execution
4. Test the integration with `fetchAirbrakes()`

## 📅 Automated Functions

### Scheduled Tasks

- **Every 6 hours**: Fetch new Airbrake errors
- **Every 7 hours**: Update Redmine ticket statuses
- **Every 8 hours**: Move resolved errors to archive
- **Every 3 days**: Check for rising occurrence errors
- **Every 7 days**: Check for low-occurrence pending errors
- **Weekly**: Generate summary reports and send reminders
- **Daily**: Send assignment summaries

### Manual Functions

- `fetchAirbrakes()`: Manually fetch current errors
- `checkAlerts()`: Check for alerts based on criteria
- `moveResolvedErrors()`: Move resolved errors to archive
- `generateWeeklySummary()`: Create weekly summary report

## 🔄 Workflow

1. **Error Detection**: Script monitors Airbrake for new errors
2. **Slack Notification**: New errors are posted to Slack with assignment dropdowns
3. **User Assignment**: Team members can assign errors to themselves or others
4. **Redmine Creation**: Automatically creates Redmine tickets for assigned errors
5. **Status Tracking**: Monitors error resolution and ticket status
6. **Cleanup**: Removes resolved errors and updates tracking

## 🎯 Alert Categories

- **⚡ Rising Occurrences**: Errors with increasing frequency
- **🔥 High-Occurrence**: Errors occurring more than 10 times
- **⚠️ Low-Occurrence Pending**: Errors pending for 7+ days
- **🚨 Critical**: Errors with 20+ occurrences
- **✅ Resolved but RM Open**: Airbrake resolved but Redmine still open

## 🔌 API Integrations

### Airbrake API
- Fetches error groups and notices
- Monitors error status changes
- Tracks occurrence counts

### Redmine API
- Creates new tickets
- Updates ticket statuses
- Manages assignments

### Slack API
- Posts error notifications
- Handles interactive elements
- Manages user assignments

## 📊 Monitoring & Reporting

- **Real-time Error Tracking**: Live updates on error status
- **Assignment History**: Complete audit trail of error assignments
- **Performance Metrics**: Weekly summaries and statistics
- **Automated Cleanup**: Removes stale and resolved errors

## 🚨 Troubleshooting

### Common Issues

1. **API Rate Limits**: Script includes delays to prevent rate limiting
2. **Permission Errors**: Ensure all API keys have proper permissions
3. **Sheet Structure**: Verify column headers match expected format
4. **Slack Permissions**: Check bot has access to required channels

### Debug Functions

- `sendDebugToSlack()`: Send debug information to Slack
- `listTriggers()`: List all configured triggers
- `logNextRunTime()`: Check next scheduled execution times

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the code comments
- Open an issue on GitHub

## 🔄 Version History

- **v1.0**: Initial release with basic error monitoring
- **v1.1**: Added Redmine integration
- **v1.2**: Implemented Slack workflow automation
- **v1.3**: Added multi-platform support and enhanced reporting

---

**Note**: This script is designed for production use and includes comprehensive error handling and logging. Always test in a development environment before deploying to production.
