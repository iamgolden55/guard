/**
 * IncidentDetailScreen
 * Display detailed information about a submitted incident
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Heading3, Body, Caption, Badge } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Incident } from '../../types/incident';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { format } from 'date-fns';

export const IncidentDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { incidentId } = (route.params as { incidentId: number }) || {};

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  const loadIncident = async () => {
    try {
      logger.info('[IncidentDetail] Loading incident', { incidentId });
      const data = await database.getIncident(incidentId);
      setIncident(data);
    } catch (error) {
      logger.error('[IncidentDetail] Failed to load incident', { error });
      Alert.alert('Error', 'Failed to load incident details');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return colors.error;
      case 'high':
        return colors.warning;
      case 'medium':
        return colors.info;
      case 'low':
        return colors.success;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return colors.success;
      case 'under_review':
        return colors.info;
      case 'submitted':
        return colors.warning;
      case 'draft':
        return colors.text.secondary;
      default:
        return colors.text.secondary;
    }
  };

  const formatIncidentType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading || !incident) {
    return (
      <Container>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Heading2>Incident Details</Heading2>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Body color={colors.text.secondary}>Loading incident details...</Body>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Heading2>Incident Details</Heading2>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badges */}
        <View style={styles.badgesRow}>
          <Badge
            label={formatIncidentType(incident.incident_type)}
            variant="info"
            style={styles.badge}
          />
          <Badge
            label={incident.severity.toUpperCase()}
            variant="warning"
            style={[styles.badge, { backgroundColor: getSeverityColor(incident.severity) }]}
          />
          {incident.status && (
            <Badge
              label={incident.status.replace('_', ' ').toUpperCase()}
              variant="default"
              style={[styles.badge, { backgroundColor: getStatusColor(incident.status) }]}
            />
          )}
        </View>

        {/* Title & Description */}
        <View style={styles.section}>
          <Heading3>{incident.title}</Heading3>
          <Body style={styles.description}>{incident.description}</Body>
        </View>

        {/* Time Information */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={colors.text.secondary} />
            <View style={styles.infoContent}>
              <Caption color={colors.text.secondary}>Occurred At</Caption>
              <Body>{format(new Date(incident.occurred_at), 'PPpp')}</Body>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="send-outline" size={20} color={colors.text.secondary} />
            <View style={styles.infoContent}>
              <Caption color={colors.text.secondary}>Reported At</Caption>
              <Body>{format(new Date(incident.reported_at), 'PPpp')}</Body>
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={24} color={colors.primary} />
            <Heading3>Location</Heading3>
          </View>
          <Body>{incident.location_description}</Body>
          {incident.latitude && incident.longitude && (
            <Caption color={colors.text.secondary} style={styles.coordinates}>
              {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}
            </Caption>
          )}
        </View>

        {/* Photos */}
        {incident.photos && incident.photos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Heading3>Photos ({incident.photos.length})</Heading3>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {incident.photos.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Voice Note */}
        {incident.voice_note && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
              <Heading3>Voice Note</Heading3>
            </View>
            <View style={styles.voiceNote}>
              <Ionicons name="play-circle-outline" size={32} color={colors.primary} />
              <Caption color={colors.text.secondary}>Voice recording attached</Caption>
            </View>
          </View>
        )}

        {/* Witnesses */}
        {incident.witnesses && incident.witnesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-outline" size={24} color={colors.primary} />
              <Heading3>Witnesses</Heading3>
            </View>
            {incident.witnesses.map((witness, index) => (
              <Body key={index} style={styles.listItem}>
                • {witness}
              </Body>
            ))}
          </View>
        )}

        {/* Persons Involved */}
        {incident.persons_involved && incident.persons_involved.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={24} color={colors.primary} />
              <Heading3>Persons Involved</Heading3>
            </View>
            {incident.persons_involved.map((person, index) => (
              <Body key={index} style={styles.listItem}>
                • {person}
              </Body>
            ))}
          </View>
        )}

        {/* Actions Taken */}
        {incident.actions_taken && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary} />
              <Heading3>Actions Taken</Heading3>
            </View>
            <Body>{incident.actions_taken}</Body>
          </View>
        )}

        {/* Emergency Services */}
        {(incident.police_notified || incident.ambulance_called) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
              <Heading3>Emergency Services</Heading3>
            </View>
            {incident.police_notified && (
              <View style={styles.emergencyRow}>
                <Ionicons name="shield-checkmark" size={20} color={colors.error} />
                <Body>Police Notified</Body>
              </View>
            )}
            {incident.ambulance_called && (
              <View style={styles.emergencyRow}>
                <Ionicons name="medical" size={20} color={colors.error} />
                <Body>Ambulance Called</Body>
              </View>
            )}
          </View>
        )}

        {/* Sync Status */}
        {incident.sync_status && (
          <View style={styles.section}>
            <View style={styles.syncStatus}>
              <Ionicons
                name={
                  incident.sync_status === 'synced'
                    ? 'cloud-done-outline'
                    : incident.sync_status === 'failed'
                    ? 'cloud-offline-outline'
                    : 'cloud-upload-outline'
                }
                size={20}
                color={
                  incident.sync_status === 'synced'
                    ? colors.success
                    : incident.sync_status === 'failed'
                    ? colors.error
                    : colors.warning
                }
              />
              <Caption
                color={
                  incident.sync_status === 'synced'
                    ? colors.success
                    : incident.sync_status === 'failed'
                    ? colors.error
                    : colors.warning
                }
              >
                {incident.sync_status === 'synced'
                  ? 'Synced to server'
                  : incident.sync_status === 'failed'
                  ? 'Sync failed - will retry'
                  : 'Pending sync'}
              </Caption>
            </View>
          </View>
        )}
      </ScrollView>
    </Container>
  );
};


const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badge: {
    marginRight: spacing.xs,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  description: {
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  coordinates: {
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  photoScroll: {
    marginTop: spacing.md,
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  voiceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  listItem: {
    marginBottom: spacing.xs,
    lineHeight: 24,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
});
