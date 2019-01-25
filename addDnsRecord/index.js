/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
/* eslint-disable func-names */
const msRestAzure = require('ms-rest-azure');
// const DNSManagment = require('azure-arm-dns');
const NetworkMgmtClient = require('azure-arm-network');
// const ResourceMgmtClient = require('azure-arm-resource').ResourceManagementClient;
const ComputeMgmtClient = require('azure-arm-compute');

async function addDnsRecord(resourceUri, subscriptionId, context) {
  const vmPath = resourceUri.split('/');
  // const dnsClient = new DNSManagment(credentials, subscriptionId);
  msRestAzure.interactiveLogin()
    .then((credentials) => {
      const computeClient = new ComputeMgmtClient(credentials, subscriptionId);
      computeClient.virtualMachines.get(
        vmPath[4], // Resource Group Name
        vmPath[vmPath.length - 1], // Virtual Machine Name
        { expand: 'instanceView' },
        (err, info) => {
          if (err) {
            context.log('An error occurred while getting VM info!\n');
            context.log(err.message);
          }
          context.log(`Got VM Information for VM \n${JSON.stringify(info)}`);
          return { vmInfo: info, credential: credentials };
        },
        (err) => {
          context.log(`An error occurred while trying to get VM information! The error was:\t${err.message}`);
        },
      );
    })
    .then((vmInfo, credential) => {
      const networkClient = new NetworkMgmtClient(credential, subscriptionId);
      const nic0Path = vmInfo.networkProfiles.networkInterfaces[0].split('/');
      networkClient.networkInterfaces.get(
        nic0Path[4], // Resource ID
        nic0Path[nic0Path.length - 1], // NIC ID
        (err, info) => {
          if (err) {
            console.log(err);
          }
          context.log(`Got NIC info for NIC\n${JSON.stringify(info)}`);
          return info;
        },
      );
    });
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
      addDnsRecord(eventData.resourceUri, eventData.subscriptionId, context);
    }
  }
};
