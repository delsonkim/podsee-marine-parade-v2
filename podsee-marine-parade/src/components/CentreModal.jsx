import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';

export default function CentreModal({ centre, open, onClose }) {
  if (!centre) return null;

  // Direct Ping Click Tracking
  const trackClick = async (type, destination) => {
    const webhookUrl = import.meta.env.VITE_CLICK_LOG_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn('VITE_CLICK_LOG_WEBHOOK_URL not configured');
      return;
    }

    const trackingData = {
      centreName: centre.name || 'unknown',
      clickType: type,
      destinationUrl: destination,
      sourcePage: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData)
      });
    } catch (error) {
      console.error('Click tracking failed:', error);
    }
  };

  const handlePrimaryAction = () => {
    const number = centre.whatsappNumber?.toString().replace(/\s/g, '');
    let destination = '';
    let clickType = '';
    
    // Debug: log the contactType to see what value we're getting
    console.log('contactType from data:', centre.contactType);
    
    // Check for WhatsApp (try multiple possible values from Excel)
    if (centre.contactType && centre.contactType.toLowerCase().includes('whatsapp') && number) {
      destination = `https://wa.me/${number}`;
      clickType = 'WhatsApp';
    } 
    // Check for LandLine/Call
    else if (centre.contactType && (centre.contactType.toLowerCase().includes('landline') || centre.contactType.toLowerCase().includes('call')) && number) {
      destination = `tel:${number}`;
      clickType = 'Call';
    } 
    // Fallback: if we have a number but couldn't determine type, default to Call
    else if (number) {
      destination = `tel:${number}`;
      clickType = 'Call';
    }
    
    if (destination && clickType) {
      console.log('Tracking click:', clickType, destination);
      trackClick(clickType, destination);
      setTimeout(() => {
        window.open(destination, '_blank');
      }, 100);
    }
  };

  const handleWebsiteClick = () => {
    if (centre.websiteUrl) {
      trackClick('Website', centre.websiteUrl);
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
