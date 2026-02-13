import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  ListSubheader,
  FormControl,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';
import UsernamePrompt from './UsernamePrompt';
import { fetchComments, createComment } from '../utils/commentService';
import { generateCentreId } from '../utils/centreIdGenerator';

// Canonical ordering
const LEVEL_ORDER = [
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6',
  'S1', 'S2', 'S3', 'S4', 'S5',
  'JC1', 'JC2',
  'IB', 'Y5 (IB)', 'Y6 (IB)',
];

const SUBJECT_ORDER = [
  'Biology', 'Chemistry', 'Physics', 'Science', 'Mathematics', 'Higher Chinese',
  'Chinese', 'English', 'Economics', 'History', 'Social Studies', 'Literature',
  'Geography', 'General Paper', 'POA', 'Malay', 'English Language & Linguistics',
  'English Language & Literature', 'China Studies in English',
];

// Human-readable level group names
const LEVEL_GROUP_NAMES = {
  P1: 'Primary 1', P2: 'Primary 2', P3: 'Primary 3', P4: 'Primary 4', P5: 'Primary 5', P6: 'Primary 6',
  S1: 'Secondary 1', S2: 'Secondary 2', S3: 'Secondary 3', S4: 'Secondary 4', S5: 'Secondary 5',
  JC1: 'JC 1', JC2: 'JC 2',
  IB: 'IB', 'Y5 (IB)': 'Year 5 (IB)', 'Y6 (IB)': 'Year 6 (IB)',
};

// Stable key for filter comparison
function filterKey(level, subject) {
  if (!level && !subject) return 'all';
  return `${level}__${subject}`;
}

export default function CommentSection({ centre, level = null, subject = null }) {
  const [username, setUsername] = useState('');
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Viewing filter: 'all' or '{level}__{subject}'
  const [viewFilter, setViewFilter] = useState('all');

  // Writing flow: selected class for new review
  const [writeClass, setWriteClass] = useState('');
  const [showWriteInput, setShowWriteInput] = useState(false);

  // Two-phase fade animation
  const [contentOpacity, setContentOpacity] = useState(1);
  const fadeTimeoutRef = useRef(null);

  // Scroll preservation
  const scrollContainerRef = useRef(null);
  const savedScrollTop = useRef(0);
  const userScrolledDuringLoad = useRef(false);

  const centreId = generateCentreId(centre);

  // Build sorted, deduplicated offerings list
  const offerings = useMemo(() => {
    if (!centre.offerings || centre.offerings.length === 0) return [];

    const seen = new Set();
    const items = [];

    centre.offerings.forEach(offering => {
      if (!offering.level || !offering.subject) return;
      const key = filterKey(offering.level, offering.subject);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          key,
          label: `${offering.level} ${offering.subject}`,
          level: offering.level,
          subject: offering.subject,
        });
      }
    });

    // Sort: LEVEL_ORDER first, then SUBJECT_ORDER, unknowns to end
    items.sort((a, b) => {
      const la = LEVEL_ORDER.indexOf(a.level);
      const lb = LEVEL_ORDER.indexOf(b.level);
      const laIdx = la === -1 ? 9999 : la;
      const lbIdx = lb === -1 ? 9999 : lb;
      if (laIdx !== lbIdx) return laIdx - lbIdx;

      const sa = SUBJECT_ORDER.indexOf(a.subject);
      const sb = SUBJECT_ORDER.indexOf(b.subject);
      const saIdx = sa === -1 ? 9999 : sa;
      const sbIdx = sb === -1 ? 9999 : sb;
      if (saIdx !== sbIdx) return saIdx - sbIdx;

      const levelCmp = a.level.localeCompare(b.level);
      if (levelCmp !== 0) return levelCmp;
      return a.subject.localeCompare(b.subject);
    });

    return items;
  }, [centre.offerings]);

  // Group offerings by level for dropdown display
  const groupedOfferings = useMemo(() => {
    const groups = [];
    let currentLevel = null;

    offerings.forEach(item => {
      if (item.level !== currentLevel) {
        currentLevel = item.level;
        groups.push({ type: 'header', level: item.level, label: LEVEL_GROUP_NAMES[item.level] || item.level });
      }
      groups.push({ type: 'item', ...item });
    });

    return groups;
  }, [offerings]);

  // Single offering? Auto-select for writing
  const singleOffering = offerings.length === 1 ? offerings[0] : null;

  // Initialize view filter based on props
  useEffect(() => {
    if (level && subject) {
      const key = filterKey(level, subject);
      const exists = offerings.some(o => o.key === key);
      setViewFilter(exists ? key : 'all');
    } else {
      setViewFilter('all');
    }
  }, [level, subject, offerings]);

  // Load username from sessionStorage
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('podsee_username');
    if (storedUsername) setUsername(storedUsername);
  }, []);

  // Parse active filter from viewFilter key
  const activeFilter = useMemo(() => {
    if (viewFilter === 'all') return null;
    const match = offerings.find(o => o.key === viewFilter);
    return match ? { level: match.level, subject: match.subject } : null;
  }, [viewFilter, offerings]);

  // Load comments when centreId or activeFilter changes
  useEffect(() => {
    loadComments();
  }, [centreId, viewFilter]);

  // Track user scroll during loading
  const handleScroll = useCallback(() => {
    if (loading) userScrolledDuringLoad.current = true;
  }, [loading]);

  const loadComments = async () => {
    setLoading(true);
    setError('');

    const activeLevel = activeFilter ? activeFilter.level : null;
    const activeSubject = activeFilter ? activeFilter.subject : null;

    const { data, error: fetchError } = await fetchComments(centreId, 20, 0, activeLevel, activeSubject);

    if (fetchError) {
      setError(fetchError);
    } else {
      setComments(data);
      setHasMore(data.length === 20);
      setOffset(20);
    }

    setLoading(false);

    if (!userScrolledDuringLoad.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollTop.current;
    }
    userScrolledDuringLoad.current = false;
  };

  const loadMoreComments = async () => {
    setLoadingMore(true);

    const activeLevel = activeFilter ? activeFilter.level : null;
    const activeSubject = activeFilter ? activeFilter.subject : null;

    const { data, error: fetchError } = await fetchComments(centreId, 20, offset, activeLevel, activeSubject);

    if (fetchError) {
      setError(fetchError);
    } else {
      setComments(prev => [...prev, ...data]);
      setHasMore(data.length === 20);
      setOffset(prev => prev + 20);
    }

    setLoadingMore(false);
  };

  const handleViewFilterChange = (event) => {
    const newValue = event.target.value;
    if (newValue === viewFilter) return;

    // Save scroll position
    if (scrollContainerRef.current) {
      savedScrollTop.current = scrollContainerRef.current.scrollTop;
    }
    userScrolledDuringLoad.current = false;

    // Two-phase fade
    setContentOpacity(0);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);

    fadeTimeoutRef.current = setTimeout(() => {
      setViewFilter(newValue);
      setContentOpacity(1);
    }, 150);
  };

  // Writing flow: parse writeClass key to level+subject
  const writeClassParsed = useMemo(() => {
    if (!writeClass) return null;
    const match = offerings.find(o => o.key === writeClass);
    return match || null;
  }, [writeClass, offerings]);

  const handleCommentSubmit = async (text) => {
    if (!username) {
      setShowUsernamePrompt(true);
      throw new Error('Username required');
    }

    const classInfo = singleOffering || writeClassParsed;
    if (!classInfo) {
      throw new Error('Please select a class first');
    }

    const { data, error: createError } = await createComment(
      centreId,
      username,
      text,
      null,
      classInfo.level,
      classInfo.subject
    );

    if (createError) {
      throw new Error(createError);
    }

    setComments(prev => [...prev, { ...data, reply_count: 0 }]);
    setShowWriteInput(false);
    setWriteClass('');
  };

  const handleWriteReviewClick = () => {
    if (!username) {
      setShowUsernamePrompt(true);
      return;
    }
    // If single offering, auto-select and show input directly
    if (singleOffering) {
      setWriteClass(singleOffering.key);
      setShowWriteInput(true);
    } else {
      setShowWriteInput(true);
    }
  };

  const handleWriteClassChange = (event) => {
    setWriteClass(event.target.value);
  };

  const handleCancelWrite = () => {
    setShowWriteInput(false);
    setWriteClass('');
  };

  const handleUsernameSubmit = (newUsername) => {
    setUsername(newUsername);
    setShowUsernamePrompt(false);
  };

  const handleUsernameRequired = () => {
    setShowUsernamePrompt(true);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  // View filter display label
  const viewFilterLabel = viewFilter === 'all'
    ? 'All Reviews'
    : (offerings.find(o => o.key === viewFilter)?.label || 'All Reviews');

  // Write placeholder
  const writePlaceholder = writeClassParsed
    ? `Share your experience with ${writeClassParsed.label} at ${centre.name}...`
    : singleOffering
      ? `Share your experience with ${singleOffering.label} at ${centre.name}...`
      : 'Share your experience...';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Fixed header with title and view selector */}
      <Box sx={{ flexShrink: 0, px: 3, pt: 2 }}>
        <Divider sx={{ mb: 2, borderColor: 'rgba(0, 0, 0, 0.08)' }} />
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
          Parent Reviews
        </Typography>

        {/* Single grouped selector */}
        <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
          <Select
            value={viewFilter}
            onChange={handleViewFilterChange}
            IconComponent={ExpandMoreIcon}
            displayEmpty
            renderValue={() => viewFilterLabel}
            sx={{
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 500,
              bgcolor: 'background.paper',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.12)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
              },
              '& .MuiSelect-select': {
                py: 1,
              },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  borderRadius: '16px',
                  mt: 0.5,
                  maxHeight: 320,
                  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
                },
              },
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '14px', fontWeight: 500 }}>
              All Reviews
            </MenuItem>

            {offerings.length > 0 && <Divider sx={{ my: 0.5 }} />}

            {groupedOfferings.map((entry, idx) => {
              if (entry.type === 'header') {
                return (
                  <ListSubheader
                    key={`header-${entry.level}`}
                    sx={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'text.secondary',
                      lineHeight: '32px',
                      bgcolor: 'background.paper',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {entry.label}
                  </ListSubheader>
                );
              }
              return (
                <MenuItem
                  key={entry.key}
                  value={entry.key}
                  sx={{
                    fontSize: '14px',
                    pl: 4,
                    py: 0.75,
                  }}
                >
                  {entry.label}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <Divider sx={{ borderColor: 'rgba(0, 0, 0, 0.06)' }} />
      </Box>

      {/* Scrollable reviews area — always mounted, content fades */}
      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 3,
          pb: 3,
          minHeight: 200,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            opacity: contentOpacity,
            transition: 'opacity 150ms ease',
            pt: 2,
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No reviews yet. Be the first to share your experience!
                </Typography>
              ) : (
                <>
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.comment_id}
                      comment={comment}
                      centreId={centreId}
                      username={username}
                      onUsernameRequired={handleUsernameRequired}
                    />
                  ))}

                  {hasMore && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Button
                        onClick={loadMoreComments}
                        disabled={loadingMore}
                        variant="outlined"
                        size="small"
                        startIcon={loadingMore && <CircularProgress size={16} />}
                      >
                        {loadingMore ? 'Loading...' : 'Load more reviews'}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Sticky write review section at bottom */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          bgcolor: 'background.paper',
          p: 2,
        }}
      >
        {!showWriteInput ? (
          /* Write a Review button */
          <Button
            variant="contained"
            onClick={handleWriteReviewClick}
            fullWidth
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
              fontWeight: 600,
              py: 1.2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: '0px 2px 6px rgba(44, 74, 58, 0.25)',
              '&:hover': {
                bgcolor: 'primary.dark',
                boxShadow: '0px 4px 10px rgba(44, 74, 58, 0.35)',
              },
              '&:active': {
                transform: 'scale(0.98)',
              },
            }}
          >
            Write a Review
          </Button>
        ) : (
          /* Write flow: class selection → text input */
          <Box>
            {/* Step 1: Class selector (mandatory) */}
            {singleOffering ? (
              /* Auto-selected single offering — show label */
              <Typography
                variant="body2"
                sx={{
                  mb: 1.5,
                  px: 1,
                  py: 0.5,
                  fontSize: '13px',
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                Reviewing: {singleOffering.label}
              </Typography>
            ) : offerings.length > 0 ? (
              /* Class selection dropdown (required) */
              <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                <Select
                  value={writeClass}
                  onChange={handleWriteClassChange}
                  displayEmpty
                  IconComponent={ExpandMoreIcon}
                  renderValue={(selected) => {
                    if (!selected) return <Typography sx={{ color: 'text.disabled', fontSize: '14px' }}>What class does your child attend?</Typography>;
                    const match = offerings.find(o => o.key === selected);
                    return match?.label || selected;
                  }}
                  sx={{
                    borderRadius: '20px',
                    fontSize: '14px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: !writeClass ? 'warning.main' : 'rgba(0, 0, 0, 0.12)',
                    },
                    '& .MuiSelect-select': {
                      py: 1,
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        borderRadius: '16px',
                        mt: 0.5,
                        maxHeight: 280,
                        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
                      },
                    },
                  }}
                >
                  {groupedOfferings.map((entry) => {
                    if (entry.type === 'header') {
                      return (
                        <ListSubheader
                          key={`write-header-${entry.level}`}
                          sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'text.secondary',
                            lineHeight: '32px',
                            bgcolor: 'background.paper',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {entry.label}
                        </ListSubheader>
                      );
                    }
                    return (
                      <MenuItem
                        key={entry.key}
                        value={entry.key}
                        sx={{ fontSize: '14px', pl: 4, py: 0.75 }}
                      >
                        {entry.label}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            ) : null}

            {/* Step 2: Text input — only shows after class selected (or single offering) */}
            {(writeClass || singleOffering) ? (
              <Box>
                <CommentInput
                  onSubmit={handleCommentSubmit}
                  onCancel={handleCancelWrite}
                  placeholder={writePlaceholder}
                  isReply={true}
                />
              </Box>
            ) : (
              /* Hint when no class selected yet */
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  color: 'text.disabled',
                  fontSize: '12px',
                  mt: 0.5,
                }}
              >
                Select a class above to start writing
              </Typography>
            )}

            {/* Cancel button */}
            {!writeClass && !singleOffering && (
              <Button
                size="small"
                onClick={handleCancelWrite}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  color: 'text.secondary',
                  fontSize: '13px',
                  display: 'block',
                  mx: 'auto',
                }}
              >
                Cancel
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Username prompt dialog */}
      <UsernamePrompt
        open={showUsernamePrompt}
        onSubmit={handleUsernameSubmit}
        onCancel={() => setShowUsernamePrompt(false)}
      />
    </Box>
  );
}
