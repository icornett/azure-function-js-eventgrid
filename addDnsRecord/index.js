/* eslint-disable no-param-reassign */
/* eslint-disable no-console */

const async = require('async');
const ComputeManagementClient = require('azure-arm-compute');
const DNSManagement = require('azure-arm-dns');
const msRestAzure = require('ms-rest-azure');
const NetworkManagementClient = require('azure-arm-network');
// eslint-disable-next-line prefer-destructuring
const ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;

function checkPrimary(ipConfiguration) {
  return ipConfiguration.primary === true;
}

async function getNicInfo(vmInfo, credentials, subscriptionId) {
  const networkClient = new NetworkManagementClient(credentials, subscriptionId);
  const nic0Path = vmInfo.networkProfile.networkInterfaces[0].id.split('/');
  return networkClient.networkInterfaces.get(
    nic0Path[4], // Resource ID
    nic0Path[nic0Path.length - 1], // NIC ID
  );
}

async function getZonesFromRg(dnsClient, rgInfo) {
  return dnsClient.zones.listByResourceGroup(rgInfo.name);
}

async function getVmInfo(vmPath, credentials, subscriptionId) {
  const computeClient = new ComputeManagementClient(credentials, subscriptionId);
  return computeClient.virtualMachines.get(
    vmPath[4], // Resource Group Name
    vmPath[vmPath.length - 1], // Virtual Machine Name
  );
}

// Get List of A records in the Zone
async function getZoneInfo(nicInfo, dnsClient, zoneList, rgName) {
  const zoneName = zoneList[0].name;
  return dnsClient.recordSets.listByType(rgName, zoneName, 'A');
}

async function isRecordExisting(rgName, vmName, zoneName, dnsClient) {
  return dnsClient.recordSets.get(rgName, zoneName, vmName, 'A');
}

async function setDnsARecord(nicInfo, dnsClient, zoneList, zoneRecords, rgName, vmName, context) {
  const zoneName = zoneList[0].name;
  const ipAddress = nicInfo.ipConfigurations.filter(checkPrimary);
  isRecordExisting(rgName, vmName, zoneName, dnsClient)
    .then((exists) => {
      if (exists && zoneList.length > 0) {
        throw new Error(`Record exists:\n${JSON.stringify(exists)}`);
      }

      dnsClient.recordSets.createOrUpdate(rgName, zoneName, vmName, 'A', {
        aRecords: [
          ipAddress[0].privateIPAddress,
        ],
      });
    })
    .catch(err => context.log(`Error occurred while setting the DNS A Record!\nThe error was:\t${err.message}\n${JSON.stringify(err)}`));
}

async function addDnsRecord(resourceUri, subscriptionId, zoneName, context) {
  let nicInfo;
  let rgInfo;
  let vmInfo;
  let zoneRecords;
  let zoneList;

  const vmPath = resourceUri.split('/');
  const rgName = vmPath[4];
  const vmName = vmPath[vmPath.length - 1];
  const credentials = await msRestAzure.interactiveLogin();
  const dnsClient = new DNSManagement(credentials, subscriptionId);
  const resourceClient = new ResourceManagementClient(credentials, subscriptionId);

  async.series([
    rgInfo = await resourceClient.resourceGroups.get(rgName)
      .catch(e => context.log(e.message)),
    zoneList = await getZonesFromRg(dnsClient, rgInfo)
      .catch(e => context.log(e.message)),
    vmInfo = await getVmInfo(vmPath, credentials, subscriptionId, context)
      .catch(e => context.log(e.message)),
    nicInfo = await getNicInfo(vmInfo, credentials, subscriptionId)
      .catch(e => context.log(e.message)),
    zoneRecords = await getZoneInfo(nicInfo, dnsClient, zoneList, rgInfo.name, context)
      .catch(e => context.log(e.message)),
    setDnsARecord(
      nicInfo,
      dnsClient,
      zoneList,
      zoneRecords,
      rgInfo.name,
      vmName,
      context,
    )
      .catch(e => context.log(e.message)),
  ]);
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
