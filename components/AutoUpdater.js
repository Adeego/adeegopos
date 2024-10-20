import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const AutoUpdater = () => {
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  useEffect(() => {
    // Check for updates on component mount
    window.electronAPI.checkForUpdates();

    // Set up listeners for update events
    window.electronAPI.onUpdateAvailable(() => {
      setUpdateAvailable(true);
      setUpdateStatus('Update available');
      console.log("Kuna update available")
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateStatus('No updates available');
      console.log("Hakuna update available")
    });

    window.electronAPI.onUpdateError((error) => {
      setUpdateStatus(`UpdateError4rmUpdater: ${error}`);
      console.log("kuna shida hapa")
    });

    window.electronAPI.onDownloadProgress((progressObj) => {
      setDownloadProgress(progressObj.percent);
      console.log("Progress iko hivi")
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
      setUpdateStatus('Update downloaded');
      console.log("Update imeshuka")
    });

    window.electronAPI.onUpdateMessage((message) => {
      setUpdateStatus(message);
      console.log("meso ya update imefika")
    });
  }, []);

  const checkForUpdates = () => {
    const result = window.electronAPI.checkForUpdates();
    console.log(result)
    console.log("Umeguza")
  };

  const downloadUpdate = () => {
    window.electronAPI.downloadUpdate();
  };

  const installUpdate = () => {
    window.electronAPI.installUpdate();
  };

  return (
    <div className="p-4 space-y-4">
      <Alert>
        <AlertTitle>Auto-Update Status</AlertTitle>
        <AlertDescription>{updateStatus}</AlertDescription>
      </Alert>

      {downloadProgress > 0 && (
        <Progress value={downloadProgress} className="w-full" />
      )}

      <div className="space-x-2">
        <Button onClick={checkForUpdates}>Check for Updates</Button>
        {updateAvailable && !updateDownloaded && (
          <Button onClick={downloadUpdate}>Download Update</Button>
        )}
        {updateDownloaded && (
          <Button onClick={installUpdate}>Install Update</Button>
        )}
      </div>
    </div>
  );
};

export default AutoUpdater;
