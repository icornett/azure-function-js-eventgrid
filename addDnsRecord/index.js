const msRestAzure = require('ms-rest-azure');
const DNSManagment = require('azure-arm-dns');

module.exports = async function (context, eventGridEvent) {
    const SubscriptionValidationEvent = "Microsoft.EventGrid.SubscriptionValidationEvent";
    const WriteSuccess = "Microsoft.Resources.ResourceWriteSuccess";
    const VmWrite = "Microsoft.Compute/virtualMachines/write";

    let eventData = eventGridEvent.data;

    if (eventGridEvent.eventType === SubscriptionValidationEvent) {
        context.log('Got SubscriptionValidation event data, validationCode: ' + eventData.validationCode + ', topic: ' + eventGridEvent.topic);
        context.res = {
            validationResponse: eventData.validationCode
        };
    } else if (eventGridEvent.eventType == WriteSuccess) {
        if (eventData.operationName == VmWrite){
            addDnsRecord(eventGridEvent.resourceUri)
        }
    }
};

function addDnsRecord(resourceUri, subscriptionId) {

}