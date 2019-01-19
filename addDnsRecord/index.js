/* eslint-disable no-console */
/* eslint-disable func-names */
// const msRestAzure = require('ms-rest-azure');
// const DNSManagment = require('azure-arm-dns');
// const NetworkMgmtClient = require('azure-arm-network');
// const ResourceMgmtClient = require('azure-arm-resource').ResourceManagementClient;

function addDnsRecord(resourceUri, subscriptionId) {
  console.log(`Resource ID: ${resourceUri}, Subscription ID: ${subscriptionId}`);
/*  msRestAzure
    .loginWithAppServiceMSI()
    .then((credentials) => {

    }); */
}

module.exports = async function (context, eventGridEvent) {
  const SubscriptionValidationEvent = 'Microsoft.EventGrid.SubscriptionValidationEvent';
  const WriteSuccess = 'Microsoft.Resources.ResourceWriteSuccess';
  const VmWrite = 'Microsoft.Compute/virtualMachines/write';

  const eventData = eventGridEvent.data;

  if (eventGridEvent.eventType === SubscriptionValidationEvent) {
    context.log(`Got SubscriptionValidation event data, validationCode: ${eventData.validationCode}, topic: ${eventGridEvent.topic}`);
    context.res = {
      validationResponse: eventData.validationCode,
    };
  } else if (eventGridEvent.eventType === WriteSuccess) {
    if (eventData.operationName === VmWrite) {
      addDnsRecord(eventGridEvent.resourceUri);
    }
  }
};
