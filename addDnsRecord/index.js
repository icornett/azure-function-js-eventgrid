/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable func-names */
const msRestAzure = require('ms-rest-azure');
const DNSManagment = require('azure-arm-dns');
const NetworkMgmtClient = require('azure-arm-network');
const ResourceMgmtClient = require('azure-arm-resource').ResourceManagementClient;
const ComputeMgmtClient = require('azure-arm-compute');

function addDnsRecord(resourceUri, subscriptionId) {
  console.log(`Resource ID: ${resourceUri}, Subscription ID: ${subscriptionId}`);
  // let virtualMachine;
  const resourceData = resourceUri.split('/');
  console.log(`Resource Group:\t${resourceData[4]}`);
  console.log(`VM Name:\t${resourceData[resourceData.length - 1]}`);
  msRestAzure
    .loginWithUsernamePassword('icornett@redapt.com', '#######')
    .then((credentials) => {
      const computeClient = new ComputeMgmtClient(credentials, subscriptionId);
      computeClient.virtualMachineId.get(
        resourceData[4], // Resource Group Name
        resourceData[resourceData.length - 1], // Virtual Machine Name
        (err, result) => {
          if (err) {
            console.log('An error occurred while getting VM info');
            console.log(err.toString());
          } else {
            // virtualMachine = result;
            console.log(JSON.stringify(result));
          }
        },
      );
    })
    .catch(
      (err) => { console.log(`${'an error occurred!\t'}${err.message}`); },
    );
}

module.exports = async function run(context, eventGridEvent) {
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
      console.log('Attempting to create DNS Record');
      addDnsRecord(eventData.resourceUri, eventData.subscriptionId);
    }
  }
};
