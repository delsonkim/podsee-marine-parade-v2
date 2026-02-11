import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';

export default function CentreModal({ centre, open, onClose }) {
  if (!centre) return null;

  // Helper function to send tracking data to Google Sheets
  const trackClick = async (type, destinationUrl) => {
    const webhookUrl = import.meta.env.VITE_CLICK_LOG_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('Tracking Webhook URL not configured');
      return;
    }

    const logData = {
      centreName: centre.name || 'unknown',
      clickType: type,
      destinationUrl: destinationUrl,
      sourcePage: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    try {
      // Use "keepalive" to ensure the request finishes even if the page starts to navigate
      fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script requires no-cors for simple POST
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
        keepalive: true
      });
    } catch (err) {
      console.error('Tracking failed:', err);
    }
  };

  const handlePrimaryAction = () => {
    const number = centre.whatsappNumber?.toString().replace(/\s/g, '');
    if (!number) return;

    const isWhatsApp = centre.contactType === 'Whatsapp';
    const type = isWhatsApp ? 'WhatsApp' : 'Call';
    const destination = isWhatsApp ? `https://wa.me/${number}` : `tel:${number}`;
    
    // 1. Send the tracking ping
    trackClick(type, destination);
    
    // 2. Wait 100ms for the ping to initiate, then open
    setTimeout(() => {
      window.open(destination, '_blank');
    }, 100);
  };

  const handleWebsiteClick = () => {
    if (centre.websiteUrl) {
      // 1. Send the tracking ping
      trackClick('Website', centre.websiteUrl);
      
      // 2. Wait 100ms for the ping to initiate, then open
      setTimeout(() => {
        window.open(centre.websiteUrl, '_blank');
      }, 100);
    }
  };

  const hasPrimaryAction = centre.whatsappNumber;
  const hasWebsite = centre.websiteUrl;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div">
          {centre.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            {centre.address}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {centre.postalCode}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1, display: 'flex', justifyContent: 'stretch', alignItems: 'stretch' }}>
        {hasPrimaryAction && (
          <Button
            variant="contained"
            onClick={handlePrimaryAction}
            startIcon={centre.contactType === 'Whatsapp' ? <WhatsAppIcon /> : <PhoneIcon />}
            sx={{ flex: '1 1 0', minWidth: 0, height: 'auto' }}
          >
            {centre.contactType === 'Whatsapp' ? 'WhatsApp' : 'Call'}
          </Button>
        )}
        
        {hasWebsite && (
          <Button
            variant="outlined"
            onClick={handleWebsiteClick}
            startIcon={<LanguageIcon />}
            sx={{ flex: '1 1 0', minWidth: 0, height: 'auto' }}
          >
            Visit Website
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
