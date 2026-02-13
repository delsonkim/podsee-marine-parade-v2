import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';
import CommentSection from './CommentSection';

export default function CentreModal({ centre, open, onClose, level = null, subject = null }) {
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
    
    if (centre.contactType === 'Whatsapp' && number) {
      destination = `https://wa.me/${number}`;
      clickType = 'WhatsApp';
    } else if (centre.contactType === 'LandLine' && number) {
      destination = `tel:${number}`;
      clickType = 'Phone';
    } else if (number) {
      // Fallback: use whatever number exists
      destination = `tel:${number}`;
      clickType = 'Phone';
    }
    
    if (destination) {
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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header - Fixed at top */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Typography variant="h6" component="div">
          {centre.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      {/* Centre Info - Fixed at top */}
      <DialogContent sx={{ flexShrink: 0, pb: 0 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            {centre.address}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {centre.postalCode}
          </Typography>
        </Box>
      </DialogContent>

      {/* Action Buttons - Fixed at top */}
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, display: 'flex', justifyContent: 'stretch', alignItems: 'stretch', flexShrink: 0 }}>
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

      {/* Parent Reviews - Flexible height with internal scrolling */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CommentSection centre={centre} level={level} subject={subject} />
      </Box>
    </Dialog>
  );
}
