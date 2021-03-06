"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require('@actions/core');
const github = require('@actions/github');
const request = require('request-promise-native');
const dateFormat = require('dateformat');
const token = require('@highwaythree/jira-github-actions-common');
async function submitBuildInfo(accessToken) {
    const cloudInstanceBaseUrl = core.getInput('cloud-instance-base-url');
    const cloudURL = new URL('/_edge/tenant_info', cloudInstanceBaseUrl);
    let cloudId = await request(cloudURL.href);
    cloudId = JSON.parse(cloudId);
    cloudId = cloudId.cloudId;
    const pipelineId = core.getInput('pipeline-id');
    const buildNumber = core.getInput('build-number');
    const buildDisplayName = core.getInput('build-display-name');
    const buildState = core.getInput('build-state');
    const buildUrl = core.getInput('build-url');
    const updateSequenceNumber = core.getInput('update-sequence-number');
    let lastUpdated = core.getInput('last-updated');
    const issueKeys = core.getInput('issue-keys');
    const commitId = core.getInput('commit-id');
    const buildRefUrl = core.getInput('build-ref-url');
    const testInfoTotalNum = core.getInput('test-info-total-num');
    const testInfoNumPassed = core.getInput('test-info-num-passed');
    const testInfoNumFailed = core.getInput('test-info-num-failed');
    const testInfoNumSkipped = core.getInput('test-info-num-skipped');
    lastUpdated = dateFormat(lastUpdated, "yyyy-mm-dd'T'HH:MM:ss'Z'");
    const buildRef = {
        commit: {
            id: commitId || github.sha || github.context.sha,
            repositoryUri: buildRefUrl || `${github.context.payload.repository.url}/actions/runs/${process.env['GITHUB_RUN_ID']}`,
        },
        ref: {
            name: "buildRef",
            uri: buildRefUrl || `${github.context.payload.repository.url}/actions/runs/${process.env['GITHUB_RUN_ID']}`,
        },
    };
    let build = {
        schemaVersion: "1.0",
        pipelineId: pipelineId || `${github.context.payload.repository.full_name} ${github.context.workflow}`,
        buildNumber: buildNumber || process.env['GITHUB_RUN_NUMBER'] || '',
        updateSequenceNumber: updateSequenceNumber || process.env['GITHUB_RUN_ID'],
        displayName: buildDisplayName || `Workflow: ${github.context.workflow} (#${process.env['GITHUB_RUN_NUMBER']})`,
        url: buildUrl || `${github.context.payload.repository.url}/actions/runs/${process.env['GITHUB_RUN_ID']}`,
        state: buildState || process.env['BUILD_STATE'],
        lastUpdated: lastUpdated || dateFormat(github.context.payload.head_commit.timestamp, "yyyy-mm-dd'T'HH:MM:ss'Z'"),
        issueKeys: issueKeys.split(',') || [],
        references: [buildRef] || [],
    };
    if (testInfoTotalNum) {
        // console.log("assign test info");
        build.testInfo = {
            totalNumber: testInfoTotalNum || undefined,
            numberPassed: testInfoNumPassed || undefined,
            numberFailed: testInfoNumFailed || undefined,
            numberSkipped: testInfoNumSkipped || undefined,
        };
    }
    let bodyData = {
        builds: [build]
    };
    bodyData = JSON.stringify(bodyData);
    const options = {
        method: 'POST',
        url: "https://api.atlassian.com/jira/builds/0.1/cloud/" + cloudId + "/bulk",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            Authorization: "Bearer " + accessToken,
        },
        body: bodyData,
    };
    let responseJson = await request(options);
    let response = JSON.parse(responseJson);
    if (response.rejectedBuilds && response.rejectedBuilds.length > 0) {
        const rejectedBuild = response.rejectedBuilds[0];
        // console.log("errors: ", rejectedBuild.errors);
        let errors = rejectedBuild.errors.map((error) => error.message).join(',');
        errors.substr(0, errors.length - 1);
        // console.log("joined errors: ", errors);
        core.setFailed(errors);
    }
    core.setOutput("response", responseJson);
}
exports.submitBuildInfo = submitBuildInfo;
(async function () {
    try {
        const clientId = core.getInput('client-id');
        const clientSecret = core.getInput('client-secret');
        const accessTokenResponse = await token.getAccessToken(clientId, clientSecret);
        await submitBuildInfo(accessTokenResponse.access_token);
        // console.log("finished submiting build info");
    }
    catch (error) {
        core.setFailed(error.message);
    }
})();
