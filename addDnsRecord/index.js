/* eslint-disable no-param-reassign */
/* eslint-disable no-console */

const async = require('async');
const ComputeManagementClient = require('azure-arm-compute');
const DNSManagement = require('azure-arm-dns');
const msRestAzure = require('ms-rest-azure');
const NetworkManagementClient = require('azure-arm-network');
const { ResourceManagementClient } = require('azure-arm-resource');

async function getNicInfo(vmInfo, credentials, subscriptionId) {
  const networkClient = new NetworkManagementClient(credentials, subscriptionId);
  const nic0Path = vmInfo.networkProfile.networkInterfaces[0].id.split('/');
  return networkClient.networkInterfaces.get(
    nic0Path[4], // Resource ID
    nic0Path[nic0Path.length - 1], // NIC ID
  );
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

async function getZonesFromRg(dnsClient, nicInfo) {
  const subnetPath = nicInfo.ipConfigurations[0].subnet.id.split('/');
  return dnsClient.zones.listByResourceGroup(subnetPath[4]);
}

async function createOrUpdateRecord(rgName, zoneName, vmName, ipv4Address, dnsClient) {
  const aRecord = new dnsClient.recordSet.ARecord(ipv4Address);
  return (
    dnsClient.recordSets.createOrUpdate(rgName, zoneName, vmName, 'A', {
      aRecords: [
        aRecord,
      ],
    })
  );
}

async function setDnsARecord(nicInfo, dnsClient, zoneList, zoneRecords, rgName, vmName) {
  const zoneName = zoneList[0].name;
  const ipAddress = nicInfo.ipConfigurations[0].privateIPAddress;

  if (zoneRecords.length === 0) {
    console.log(`Setting ${vmName} IP v4 address to:\t${ipAddress}`);
    try {
      createOrUpdateRecord(rgName, zoneName, vmName, ipAddress, dnsClient);
    } catch (e) {
      console.log(`Could not update record, error was ${e.message}`);
    }
  } else if (zoneRecords.filter(record => record.name === vmName)) {
    if (zoneRecords.filter(record => record.aRecords.ipv4Address === ipAddress)) {
      console.log(`DNS 'A' Record exists for IPv4 Address:\t${ipAddress}`);
    } else {
      console.log('This record does not match...  updating');
      createOrUpdateRecord(rgName, zoneName, vmName, ipAddress, dnsClient)
        .catch(e => console.log(`An error occurred while updating, the error was:\t${e.message}`));
    }
  } else {
    console.log(`Attempting to add new DNS 'A' Record for:\t${vmName} at IP Address ${ipAddress}`);
    createOrUpdateRecord(rgName, zoneName, vmName, ipAddress, dnsClient)
      .catch(e => console.log(`An error occurred while updating, the error was:\t${e.message}`));
  }
}

async function addDnsRecord(resourceUri, subscriptionId, context) {
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
    vmInfo = await getVmInfo(vmPath, credentials, subscriptionId, context)
      .catch(e => context.log(e.message)),
    nicInfo = await getNicInfo(vmInfo, credentials, subscriptionId)
      .catch(e => context.log(e.message)),
    zoneList = await getZonesFromRg(dnsClient, nicInfo)
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
      addDnsRecord(eventData.resourceUri, eventData.subscriptionId, context)
        .catch(e => context.log(`An error occurred while adding your DNS record, as such we suck and have failed you... \n${e.message}`));
    }
  }
};
